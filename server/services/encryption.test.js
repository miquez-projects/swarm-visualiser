// Set encryption key before requiring the module (it derives key on load)
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';

const { encrypt, decrypt } = require('./encryption');

describe('Encryption Service', () => {
  describe('encrypt', () => {
    test('returns a string in iv:authTag:encrypted format', () => {
      const result = encrypt('hello');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      // Each part should be a valid hex string
      parts.forEach(part => {
        expect(part).toMatch(/^[0-9a-f]+$/);
      });
      // IV should be 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // Auth tag should be 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
    });

    test('produces different ciphertexts for same input (random IV)', () => {
      const a = encrypt('same-input');
      const b = encrypt('same-input');
      expect(a).not.toBe(b);
    });
  });

  describe('decrypt', () => {
    test('round-trips correctly', () => {
      const original = 'my secret token';
      const encrypted = encrypt(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    test('handles special characters (JSON tokens)', () => {
      const json = '{"access_token":"abc123","scope":"read,write"}';
      const encrypted = encrypt(json);
      expect(decrypt(encrypted)).toBe(json);
    });

    test('handles empty string', () => {
      // encrypt throws on falsy input
      expect(() => encrypt('')).toThrow('Text to encrypt is required');
      expect(() => decrypt('')).toThrow('Encrypted text is required');
    });

    test('rejects tampered ciphertext', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      parts[2] = 'ff' + parts[2].slice(2); // flip a byte
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    test('rejects tampered auth tag', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      parts[1] = 'ff' + parts[1].slice(2); // flip a byte in auth tag
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    test('rejects malformed input — wrong number of parts', () => {
      expect(() => decrypt('aabb:ccdd')).toThrow();
      expect(() => decrypt('aabb')).toThrow();
    });

    test('rejects malformed input — invalid hex', () => {
      expect(() => decrypt('zzzz:zzzz:zzzz')).toThrow();
    });

    test('rejects null input', () => {
      expect(() => decrypt(null)).toThrow();
    });
  });
});
