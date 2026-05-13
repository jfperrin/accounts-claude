process.env.MFA_ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes hex
const { encrypt, decrypt } = require('../utils/cryptoBox');

describe('cryptoBox', () => {
  it('round-trip', () => {
    const plain = 'JBSWY3DPEHPK3PXP';
    const token = encrypt(plain);
    expect(token).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    expect(decrypt(token)).toBe(plain);
  });

  it('produit un ciphertext différent à chaque appel (IV aléatoire)', () => {
    const plain = 'JBSWY3DPEHPK3PXP';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('rejette un token altéré (auth tag invalide)', () => {
    const tok = encrypt('hello');
    const broken = tok.slice(0, -2) + '00';
    expect(() => decrypt(broken)).toThrow();
  });

  it('rejette un format invalide', () => {
    expect(() => decrypt('not-a-valid-token')).toThrow();
  });
});
