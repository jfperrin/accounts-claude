const { generateEmailCode, generateRecoveryCodes } = require('../utils/mfaCodes');

describe('mfaCodes', () => {
  it('generateEmailCode renvoie 6 chiffres', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateEmailCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('generateRecoveryCodes renvoie 10 codes alphanum 10 chars', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const c of codes) {
      expect(c).toMatch(/^[a-z0-9]{10}$/);
    }
    expect(new Set(codes).size).toBe(10);
  });
});
