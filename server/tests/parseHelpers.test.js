// Tests unitaires des helpers partagés (parseDate / parseAmount), réutilisés
// par parseQif et parseOfx.

const { parseDate, parseAmount } = require('../utils/parseHelpers');

describe('parseAmount', () => {
  it('parse FR (virgule décimale)', () => {
    expect(parseAmount('1234,56')).toBe(1234.56);
    expect(parseAmount('-210,00')).toBe(-210);
  });

  it('parse FR avec point millier', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });

  it('parse US (point décimal)', () => {
    expect(parseAmount('1234.56')).toBe(1234.56);
    expect(parseAmount('-210.00')).toBe(-210);
  });

  it('parse US avec virgule millier', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('parse les espaces (séparateurs de milliers FR)', () => {
    expect(parseAmount(' 1 234,56')).toBe(1234.56);
  });

  it('retourne null pour entrée vide ou invalide', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount('xyz')).toBeNull();
  });
});

describe('parseDate', () => {
  it('parse format FR DD/MM/YYYY', () => {
    const d = parseDate('25/04/2026');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3); // 0-indexé, avril = 3
    expect(d.getUTCDate()).toBe(25);
  });

  it('parse format ISO YYYY-MM-DD', () => {
    const d = parseDate('2026-04-25');
    expect(d.getUTCDate()).toBe(25);
  });

  it('retourne null pour formats inconnus', () => {
    expect(parseDate('25 avril 2026')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});
