// utils/fetchOtp.ts
//
// ==============================================================================
// SHARED OTP FETCHER — used by global-setup and tests
// ==============================================================================

import { ImapFlow } from 'imapflow';

const OTP_EMAIL_TIMEOUT_MS = 60_000;
const OTP_POLL_INTERVAL_MS = 3_000;

function extractPlainText(raw: string): string {
  const parts = raw.split(/--[^\r\n]+/);
  for (const part of parts) {
    if (!/content-type:\s*text\/plain/i.test(part)) continue;
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
  return '';
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

        const contextMatch = searchIn.match(
          /(?:otp|code|verification|verify|token|digit)[^a-z\d]{0,60}(\d{6})|(\d{6})[^a-z\d]{0,60}(?:otp|code|verification|verify|expired|minutes)/i
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
