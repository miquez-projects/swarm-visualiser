const crypto = require('crypto');

// In production, this should be a strong, randomly generated key stored securely
// For now, we'll derive it from an environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
  crypto.scryptSync(process.env.DATABASE_URL || 'default-secret', 'salt', 32);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string (e.g., OAuth access token)
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text in format: iv:authTag:encryptedData (hex encoded)
 */
function encrypt(text) {
  if (!text) {
    throw new Error('Text to encrypt is required');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return as iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted text in format: iv:authTag:encryptedData
 * @returns {string} Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText) {
    throw new Error('Encrypted text is required');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, encryptedData] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
