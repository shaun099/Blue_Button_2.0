import crypto from 'crypto';

// Creates a URL-safe, base64-encoded string from a buffer.
const base64URLEncode = (buffer) => {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Hashes a string using the SHA-256 algorithm.
const sha256 = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest();
};

/**
 * Generates the PKCE code_verifier and the corresponding code_challenge.
 * The verifier is a high-entropy random string.
 * The challenge is the SHA-256 hash of the verifier.
 */
export const generatePkce = () => {
  const code_verifier = base64URLEncode(crypto.randomBytes(32));
  const code_challenge = base64URLEncode(sha256(code_verifier));
  return { code_verifier, code_challenge };
};

