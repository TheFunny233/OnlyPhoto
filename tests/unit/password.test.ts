import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('produces a salted scrypt hash, not plaintext', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('correct horse');
  });

  it('verifies the correct password', () => {
    const hash = hashPassword('s3cret-pass');
    expect(verifyPassword('s3cret-pass', hash)).toBe(true);
  });

  it('rejects the wrong password', () => {
    const hash = hashPassword('s3cret-pass');
    expect(verifyPassword('wrong-pass', hash)).toBe(false);
  });

  it('produces different hashes for the same password (random salt)', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});