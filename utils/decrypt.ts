// ═══════════════════════════════════════════════════════════════════════════
// DECRYPT.TS - Credential Decryption Utility
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
//   Decrypts credentials from credentials.enc file using keys from .env
//   Used by global-setup.ts to retrieve username/password for login
//
// ENVIRONMENT VARIABLES REQUIRED:
//   - CREDENTIAL_KEY → 64-character hex string (32 bytes)
//   - CREDENTIAL_IV  → 32-character hex string (16 bytes)
//
// SECURITY:
//   - Keys stored in .env (never committed to git)
//   - Credentials.enc is encrypted (safe to commit)
//   - Decryption happens at runtime only
//
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

// AES-256-CBC encryption algorithm (same as encrypt.ts)
const algorithm = 'aes-256-cbc';

// Read encrypted credentials from file
const encryptedData = fs.readFileSync(path.join(__dirname, 'credentials.enc'), 'utf8');

// Get encryption keys from environment variables
const keyHex = process.env.CREDENTIAL_KEY;
const ivHex = process.env.CREDENTIAL_IV;

// Verify environment variables are set
if (!keyHex || !ivHex) {
  throw new Error('CREDENTIAL_KEY or CREDENTIAL_IV not set in .env file!');
}

// Convert hex strings back to buffers
const key = Buffer.from(keyHex, 'hex');
const iv = Buffer.from(ivHex, 'hex');

// Create decipher with algorithm, key, and IV
const decipher = crypto.createDecipheriv(algorithm, key, iv);

// Decrypt the credentials
let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
decrypted += decipher.final('utf8');

// Parse JSON and export credentials object
const credentials = JSON.parse(decrypted);

// Export credentials for use in global-setup.ts
export default credentials;
