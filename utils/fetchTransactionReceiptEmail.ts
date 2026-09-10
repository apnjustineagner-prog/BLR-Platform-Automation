// utils/fetchTransactionReceiptEmail.ts
//
// ==============================================================================
// TRANSACTION RECEIPT EMAIL FETCHER
// ==============================================================================
//
// Polls Gmail via IMAP for the Payment Console "Transaction Successful!"
// receipt email sent after a successful payment, and returns its decoded body
// so a spec can assert the receipt details (Merchant Reference, Account
// Number, amounts, etc.).
//
// Modeled on utils/fetchActivationEmail.ts, but reuses the more robust
// boundary-aware MIME decoder from utils/fetchOtp.ts because the Billeroo
// email templates are HTML-only (a naive split(/--[^\r\n]+/) shreds them at
// every `<!--` MSO comment — confirmed on the OTP template).
//
// The receipt email is matched by its Merchant Reference No. (unique per
// transaction), so it can never pick up a stale receipt from a previous run
// — the same discipline as the OTP/activation fetchers' since+exact-time
// recheck, but keyed on content that's guaranteed unique.
//
// USAGE (in a spec):
//   const beforePayment = new Date();            // BEFORE submitting the payment
//   const { merchantReference, amount } = await payBayadSuccessfully(...);
//   const email = await fetchTransactionReceiptEmail(beforePayment, merchantReference);
//   expect(email.body).toContain('Transaction Successful');
//
// ==============================================================================

import { ImapFlow } from 'imapflow';

const EMAIL_TIMEOUT_MS = 120_000;
const EMAIL_POLL_MS    = 3_000;

export const RECEIPT_EMAIL_SENDER = 'billeroo';

export type TransactionReceiptEmailResult = {
  subject:     string;
  toAddress:   string;
  fromAddress: string;
  body:        string;
  // Raw decoded HTML of the email (before stripHtml), when the email has an
  // HTML part. Used to render + screenshot the email for the report. Empty
  // string if the email is plain-text only.
  html:        string;
};

// ------------------------------------------------------------------------------
// MIME decoding — same robust, boundary-aware approach as utils/fetchOtp.ts.
// ------------------------------------------------------------------------------

function decodeBody(body: string, encoding: string): string {
  if (encoding === 'base64') {
    return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
  }
  if (encoding === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return body;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ');
}

function extractPart(part: string): string {
  const encodingMatch = part.match(/^content-transfer-encoding:\s*(\S+)/im);
  const encoding = encodingMatch?.[1]?.toLowerCase() ?? 'none';
  const isHtml = /^content-type:\s*text\/html/im.test(part);
  const bodyStart = part.indexOf('\r\n\r\n');
  const body = bodyStart !== -1 ? part.slice(bodyStart + 4) : part;
  const decoded = decodeBody(body, encoding);
  return isHtml ? stripHtml(decoded) : decoded;
}

// Decode a single MIME part's body without stripping HTML — used to keep the
// raw HTML for rendering/screenshotting the email.
function decodePartRaw(part: string): string {
  const encodingMatch = part.match(/^content-transfer-encoding:\s*(\S+)/im);
  const encoding = encodingMatch?.[1]?.toLowerCase() ?? 'none';
  const bodyStart = part.indexOf('\r\n\r\n');
  const body = bodyStart !== -1 ? part.slice(bodyStart + 4) : part;
  return decodeBody(body, encoding);
}

// Prefer text/plain, fall back to text/html (stripped), and also surface the
// raw (unstripped) HTML when present so callers can render/screenshot it.
// Only split on a real MIME boundary declared in the top-level Content-Type.
function extractEmailContent(raw: string): { text: string; html: string } {
  const headerEnd = raw.indexOf('\r\n\r\n');
  const topHeaders = headerEnd !== -1 ? raw.slice(0, headerEnd) : raw;
  const boundaryMatch = topHeaders.match(/content-type:[^\r\n]*boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    const isHtml = /^content-type:\s*text\/html/im.test(raw);
    return { text: extractPart(raw), html: isHtml ? decodePartRaw(raw) : '' };
  }

  const boundary = boundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = raw.split(new RegExp(`--${boundary}`));
  let plain = '';
  let htmlStripped = '';
  let htmlRaw = '';
  for (const part of parts) {
    const isPlain = /^content-type:\s*text\/plain/im.test(part);
    const isHtml = /^content-type:\s*text\/html/im.test(part);
    if (!isPlain && !isHtml) continue;
    if (isPlain && !plain) plain = extractPart(part);
    if (isHtml && !htmlRaw) {
      htmlRaw = decodePartRaw(part);
      htmlStripped = extractPart(part);
    }
  }
  // Prefer plain text for the body assertion; fall back to stripped HTML.
  return { text: plain || htmlStripped, html: htmlRaw };
}

// ------------------------------------------------------------------------------
// Fetcher
// ------------------------------------------------------------------------------

/**
 * Waits up to 120s for the "Transaction Successful!" receipt email that
 * arrived after `afterTimestamp` and whose decoded body contains
 * `merchantReference` (unique per transaction, so it can't match a stale
 * receipt). Returns the email's envelope fields + decoded body.
 *
 * Opens [Gmail]/All Mail rather than INBOX — Billeroo emails are often
 * filed under Gmail's Promotions tab, invisible to an INBOX-only IMAP
 * search (same gotcha handled by fetchActivationEmail.ts).
 *
 * Throws if no matching email is found within the timeout.
 */
export async function fetchTransactionReceiptEmail(
  afterTimestamp: Date,
  merchantReference: string,
): Promise<TransactionReceiptEmailResult> {
  const deadline = Date.now() + EMAIL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER!,
        pass: process.env.GMAIL_APP_PASSWORD!,
      },
      logger: false,
    });

    await client.connect();

    try {
      await client.mailboxOpen('[Gmail]/All Mail');
      const uids = await client.search({ since: afterTimestamp });
      const uidList = Array.isArray(uids) ? [...uids].reverse() : [];

      for (const uid of uidList) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          source: true,
        });

        if (!msg || !msg.envelope?.date) continue;
        // IMAP 'since' is date-granular — re-check the actual time so a
        // receipt from earlier the same day can't be picked up.
        if (new Date(msg.envelope.date) < afterTimestamp) continue;

        const subject     = msg.envelope.subject ?? '';
        const toAddress   = msg.envelope.to?.[0]?.address ?? '';
        const fromAddress = msg.envelope.from?.[0]?.address ?? '';
        const raw            = msg.source?.toString('utf8') ?? '';
        const { text: body, html } = extractEmailContent(raw);

        // The unique merchant reference is the reliable match — a receipt
        // email that contains it is unambiguously this transaction's.
        if (!body.includes(merchantReference)) continue;

        console.log(`[fetchTransactionReceiptEmail] Receipt found for ${merchantReference} (to ${toAddress})`);
        return { subject, toAddress, fromAddress, body, html };
      }
    } finally {
      await client.logout();
    }

    console.log('[fetchTransactionReceiptEmail] Receipt email not yet received, retrying...');
    await new Promise((r) => setTimeout(r, EMAIL_POLL_MS));
  }

  throw new Error(
    `Transaction receipt email for merchant reference "${merchantReference}" not received within ${EMAIL_TIMEOUT_MS / 1000}s`,
  );
}
