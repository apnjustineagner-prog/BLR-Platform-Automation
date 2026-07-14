// ═══════════════════════════════════════════════════════════════════════════
// ENCRYPT.TS - Credential Encryption Utility
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
//   Encrypts sensitive credentials (username/password) using AES-256-CBC
//   encryption and saves them to credentials.enc file.
//
// USAGE:
//   1. Fill in username and password in the credentials object below
//   2. Run: npx ts-node utils/encrypt.ts
//   3. Copy CREDENTIAL_KEY and CREDENTIAL_IV from key.json to .env
//   4. Delete or clear the username/password from this file for security
//
// OUTPUT FILES:
//   - credentials.enc → encrypted credentials (safe to commit)
//   - key.json → encryption keys (DO NOT COMMIT - add to .gitignore)
//
// SECURITY:
//   - Uses AES-256-CBC encryption (industry standard)
//   - Generates random 32-byte key and 16-byte IV
//   - Keys should be stored in .env file, never in code
//
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

// AES-256-CBC encryption algorithm
const algorithm = 'aes-256-cbc';

// Generate random encryption key (32 bytes for AES-256)
const secretKey = crypto.randomBytes(32);

// Generate random initialization vector (16 bytes)
const iv = crypto.randomBytes(16);

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 FILL IN YOUR CREDENTIALS HERE (then clear after encryption!)
// ═══════════════════════════════════════════════════════════════════════════
const credentials = {
  username: '', // ← Fill this with your username
  password: '', // ← Fill this with your password
};
// ═══════════════════════════════════════════════════════════════════════════

// Create cipher with algorithm, key, and IV
const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

// Encrypt the credentials JSON
let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
encrypted += cipher.final('hex');

// Save encrypted credentials to file (safe to commit to git)
fs.writeFileSync(path.join(__dirname, 'credentials.enc'), encrypted);

// Save encryption keys to key.json (DO NOT COMMIT!)
fs.writeFileSync(
  path.join(__dirname, 'key.json'),
  JSON.stringify({
    key: secretKey.toString('hex'),
    iv: iv.toString('hex'),
  })
);

console.log('Encrypted credentials saved!');
console.log('Next steps:');
console.log('   1. Copy key and iv from key.json to your .env file');
console.log('   2. Clear username/password from this file');
console.log('   3. Add key.json to .gitignore');
