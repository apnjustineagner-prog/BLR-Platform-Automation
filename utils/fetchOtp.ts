// utils/fetchOtp.ts
//
// ==============================================================================
// SHARED OTP FETCHER — used by global-setup and tests
// ==============================================================================

import { ImapFlow } from 'imapflow';

const OTP_EMAIL_TIMEOUT_MS = 60_000;
const OTP_POLL_INTERVAL_MS = 3_000;

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
    .replace(/&quot;/gi, '"');
}

// Decodes a single MIME part (or a whole non-multipart message) using its
// own Content-Transfer-Encoding/Content-Type headers. Header regexes are
// anchored to the start of a line (^ + /m) so they can't match a header
// *name* mentioned inside an unrelated header's value — e.g. a
// DKIM-Signature's `h=feedback-id:date:message-id:content-transfer-encoding:mime-version`
// header list contains the literal substring "content-transfer-encoding:"
// followed by "mime-version", which an unanchored regex would misread as a
// real (bogus) encoding declaration.
function extractPart(part: string): string {
  const encodingMatch = part.match(/^content-transfer-encoding:\s*(\S+)/im);
  const encoding = encodingMatch?.[1]?.toLowerCase() ?? 'none';
  const isHtml = /^content-type:\s*text\/html/im.test(part);
  const bodyStart = part.indexOf('\r\n\r\n');
  const body = bodyStart !== -1 ? part.slice(bodyStart + 4) : part;
  const decoded = decodeBody(body, encoding);
  return isHtml ? stripHtml(decoded) : decoded;
}

// Prefers a text/plain part; falls back to text/html (stripped of tags) —
// confirmed the Billeroo OTP template is text/html only, so text/plain
// never matches. Only splits on a MIME boundary when the top-level
// Content-Type header actually declares one: a generic split on any "--"
// sequence (the previous approach) shreds a single-part HTML email at every
// "<!--" MSO/Outlook conditional comment in the body, losing everything
// after the first one — confirmed on this template, which has several.
function extractPlainText(raw: string): string {
  const headerEnd = raw.indexOf('\r\n\r\n');
  const topHeaders = headerEnd !== -1 ? raw.slice(0, headerEnd) : raw;
  const boundaryMatch = topHeaders.match(/content-type:[^\r\n]*boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) return extractPart(raw);

  const boundary = boundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = raw.split(new RegExp(`--${boundary}`));
  let htmlFallback = '';
  for (const part of parts) {
    const isPlain = /^content-type:\s*text\/plain/im.test(part);
    const isHtml = /^content-type:\s*text\/html/im.test(part);
    if (!isPlain && !isHtml) continue;
    const decoded = extractPart(part);
    if (isPlain) return decoded;
    htmlFallback = decoded;
  }
  return htmlFallback;
}

export async function fetchOtpFromGmail(afterTimestamp: Date): Promise<string> {
  const deadline = Date.now() + OTP_EMAIL_TIMEOUT_MS;

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
      await client.mailboxOpen('INBOX');
      const uids = await client.search({ since: afterTimestamp });
      const uidList = Array.isArray(uids) ? [...uids].reverse() : [];

      for (const uid of uidList) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          source: true,
        });

        if (!msg || !msg.envelope?.date) continue;
        if (new Date(msg.envelope.date) < afterTimestamp) continue;

        const raw = msg.source?.toString('utf8') ?? '';
        const plainText = extractPlainText(raw);
        const searchIn = plainText || raw;

        require('fs').writeFileSync('/tmp/otp_email_debug.txt', raw);

        // "pin" added after confirming the actual Billeroo OTP template reads
        // "Here is your One-Time PIN: 123456" — none of the other context
        // words appear in it, so this always fell through to the fallback.
        const contextMatch = searchIn.match(
          /(?:otp|code|verification|verify|token|digit|pin)[^a-z\d]{0,60}(\d{6})|(\d{6})[^a-z\d]{0,60}(?:otp|code|verification|verify|expired|minutes|pin)/i
        );
        if (contextMatch) {
          const otp = contextMatch[1] ?? contextMatch[2];
          console.log(`[fetchOtp] OTP found by context: ${otp}`);
          return otp;
        }

        const fallback = searchIn.match(/(?<!#)\b([1-9]\d{5}|\d{5}[1-9])\b/);
        if (fallback) {
          console.log(`[fetchOtp] OTP found (fallback): ${fallback[1]}`);
          return fallback[1];
        }

        console.log(`[fetchOtp] No OTP found in email dated ${msg.envelope.date}`);
      }
    } finally {
      await client.logout();
    }

    console.log('[fetchOtp] OTP email not yet received, retrying...');
    await new Promise((r) => setTimeout(r, OTP_POLL_INTERVAL_MS));
  }

  throw new Error(`OTP email not received within ${OTP_EMAIL_TIMEOUT_MS / 1000}s`);
}
