import crypto from 'crypto';

// Get encryption credentials from environment variables.
// In a real application, these must be set in your .env file or server environment.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ; // Replace with a real 32-byte key
const INIT_VECTOR = process.env.INIT_VECTOR ; 

console.log(ENCRYPTION_KEY)// Replace with a real 16-byte IV

// Check if keys are valid (basic check)
// eslint-disable-next-line no-undef
if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes long.');
}

// Do the same for the INIT_VECTOR
if (Buffer.from(INIT_VECTOR, 'hex').length !== 16) {
    throw new Error('INIT_VECTOR must be 16 bytes long.');
}
const ALGORITHM = 'aes-256-gcm'; // Using a modern, authenticated encryption algorithm

/**
 * Encrypts a plain text string.
 * @param {string} text - The text to encrypt (e.g., the refresh token).
 * @returns {string} The encrypted text, including the auth tag, in hex format.
 */
export const encrypt = (text) => {
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, INIT_VECTOR);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // We combine the encrypted data and the auth tag.
  // The auth tag is crucial for verifying data integrity upon decryption.
  return `${encrypted}:${authTag}`;
};

/**
 * Decrypts an encrypted string.
 * @param {string} encryptedText - The encrypted text from the database.
 * @returns {string} The original plain text.
 */
export const decrypt = (encryptedText) => {
  try {
    const parts = encryptedText.split(':');
    const encryptedData = parts[0];
    const authTag = Buffer.from(parts[1], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, INIT_VECTOR);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error.message);
    // If decryption fails, it could mean the data is corrupt or the key is wrong.
    // It's important to handle this error gracefully in your application.
    throw new Error("Decryption failed.");
  }
};
