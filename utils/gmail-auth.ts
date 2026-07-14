// utils/gmail-auth.ts
//
// ==============================================================================
// ONE-TIME GMAIL OAUTH2 AUTHORIZATION
// ==============================================================================
//
// PURPOSE:
//   Run this ONCE to generate the GMAIL_REFRESH_TOKEN for your .env file.
//   After that, the refresh token is reused indefinitely (no re-auth needed).
//
// STEPS:
//   1. Go to https://console.cloud.google.com/
//   2. Create a project → APIs & Services → Enable Gmail API
//   3. Create OAuth2 credentials → Desktop app
//   4. Download credentials, copy client_id and client_secret to .env:
//        GMAIL_CLIENT_ID=your-client-id
//        GMAIL_CLIENT_SECRET=your-client-secret
//   5. Run: npx ts-node utils/gmail-auth.ts
//   6. Open the URL printed in the terminal, authorize the app
//   7. Paste the code shown in the browser back into the terminal
//   8. Copy the printed GMAIL_REFRESH_TOKEN to your .env
//
// REQUIRED GMAIL SCOPE:
//   https://www.googleapis.com/auth/gmail.readonly
//
// ==============================================================================

import { google } from 'googleapis';
import * as readline from 'readline';
import 'dotenv/config';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function main() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.error('ERROR: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // Desktop/CLI redirect
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force refresh token to be returned
  });

  console.log('\nStep 1: Open this URL in your browser and authorize access:');
  console.log('\n' + authUrl + '\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Step 2: Paste the authorization code here: ', async (code) => {
    rl.close();

    try {
      const { tokens } = await oauth2Client.getToken(code.trim());

      if (!tokens.refresh_token) {
        console.error('\nERROR: No refresh token returned.');
        console.error('Make sure you used prompt: "consent" and this is the first authorization.');
        process.exit(1);
      }

      console.log('\nStep 3: Add this to your .env file:\n');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\nDone! You can now use global-setup-gmail.ts');
    } catch (err) {
      console.error('Failed to get tokens:', err);
      process.exit(1);
    }
  });
}

main();
