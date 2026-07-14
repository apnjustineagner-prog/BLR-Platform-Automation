// utils/fetchActivationEmail.ts
//
// Polls Gmail via IMAP for an activation email sent after a given timestamp.
// Used to verify Resend Activation sends to the correct recipient.

import { ImapFlow } from 'imapflow';

const EMAIL_TIMEOUT_MS  = 120_000;
const EMAIL_POLL_MS     = 3_000;

export const ACTIVATION_EMAIL_SUBJECT = 'Activate Account and Set Account Details';
export const ACTIVATION_EMAIL_SENDER  = 'test-support@billeroo.com';

export type ActivationEmailResult = {
  subject:        string;
  toAddress:      string;
  fromAddress:    string;
  body:           string;
  activationLink: string | null;
};

function decodePart(part: string): string {
  const encodingMatch = part.match(/content-transfer-encoding:\s*(\S+)/i);
  const encoding = encodingMatch?.[1]?.toLowerCase() ?? 'none';
  const bodyStart = part.indexOf('\r\n\r\n');
  const body = bodyStart !== -1 ? part.slice(bodyStart + 4) : part;
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

function extractPlainText(raw: string): string {
  const parts = raw.split(/--[^\r\n]+/);
  for (const part of parts) {
    if (!/content-type:\s*text\/plain/i.test(part)) continue;
    return decodePart(part);
  }
  return raw;
}

// The link often lives only in the HTML part, so decode every part before
// matching — regexing the raw source lets a quoted-printable soft line break
// (=\r\n) truncate the URL mid-token, and the half-link 404s.
function extractActivationLink(raw: string): string | null {
  const decoded = raw.split(/--[^\r\n]+/).map(decodePart).join('\n');
  const match = decoded.match(/https?:\/\/[^\s"'<>()]*activat[^\s"'<>()]*/i);
  return match ? match[0].replace(/&amp;/g, '&') : null;
}

/**
 * Waits up to 60 s for an activation email that arrived after `afterTimestamp`
 * and whose recipient matches `expectedRecipient` (case-insensitive substring).
 *
 * Throws if no matching email is found within the timeout.
 */
export async function fetchActivationEmail(
  afterTimestamp: Date,
  expectedRecipient: string,
): Promise<ActivationEmailResult> {
  const deadline = Date.now() + EMAIL_TIMEOUT_MS;

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
  // Activation emails from billeroo are categorized as Promotions by Gmail,
  // so they don't appear in INBOX via IMAP. All Mail covers every label.
  await client.mailboxOpen('[Gmail]/All Mail');

  try {
    while (Date.now() < deadline) {
      const uids = await client.search({ since: afterTimestamp });
      const uidList = Array.isArray(uids) ? [...uids].reverse() : [];

      for (const uid of uidList) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          source: true,
        });

        if (!msg) continue;
        if (!msg.envelope?.date) continue;
        if (new Date(msg.envelope.date) < afterTimestamp) continue;

        const subject     = msg.envelope.subject ?? '';
        const toAddress   = msg.envelope.to?.[0]?.address ?? '';
        const fromAddress = msg.envelope.from?.[0]?.address ?? '';
        const raw         = msg.source?.toString('utf8') ?? '';
        const body        = extractPlainText(raw);
        const activationLink = extractActivationLink(raw);

        if (!toAddress.toLowerCase().includes(expectedRecipient.toLowerCase())) continue;
        if (!/activat/i.test(subject) && !/activat/i.test(body)) continue;

        // Log the extracted link so a 404 on navigation is diagnosable —
        // a truncated/garbage URL here means extraction broke, not the backend.
        console.log(`[fetchActivationEmail] Link for ${toAddress}: ${activationLink}`);
        return { subject, toAddress, fromAddress, body, activationLink };
      }

      await new Promise((r) => setTimeout(r, EMAIL_POLL_MS));
    }
  } finally {
    await client.logout();
  }

  throw new Error(
    `Activation email to "${expectedRecipient}" not received within ${EMAIL_TIMEOUT_MS / 1000}s`,
  );
}
