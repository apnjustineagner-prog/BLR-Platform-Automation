// utils/cleanInbox.ts
//
// ==============================================================================
// INBOX CLEANUP — move old Billeroo emails to Trash so the inbox doesn't pile up
// ==============================================================================
//
// GMAIL_USER is a personal account, so this is deliberately scoped to messages
// whose From header contains "billeroo" — never touch anything else. Moved
// messages sit in Gmail's Trash (auto-purged after 30 days), so nothing is
// lost irrecoverably.

import { ImapFlow } from 'imapflow';

const SENDER_FILTER = 'billeroo';

export async function cleanBillerooEmails(): Promise<void> {
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
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ from: SENDER_FILTER }, { uid: true });
      if (!Array.isArray(uids) || uids.length === 0) {
        console.log('[cleanInbox] No Billeroo emails to clean');
        return;
      }

      // Resolve the Trash folder by special-use flag — its display name
      // varies with the account's language setting.
      const mailboxes = await client.list();
      const trash =
        mailboxes.find((m) => m.specialUse === '\\Trash')?.path ?? '[Gmail]/Trash';

      await client.messageMove(uids, trash, { uid: true });
      console.log(`[cleanInbox] Moved ${uids.length} Billeroo email(s) to ${trash}`);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
