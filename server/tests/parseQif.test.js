// Tests unitaires du parser QIF.

const { parseBankQif } = require('../utils/parseQif');

describe('parseBankQif', () => {
  const sample = [
    '!Type:Bank',
    'D25/04/2026',
    'T-210.00',
    'PVIR INST WERO',
    '^',
    'D24/04/2026',
    'T-80,00',           // virgule décimale FR
    'PCARTE PHARMACIE',
    'MMemo additionnel', // ignoré (Payee présent)
    '^',
    '',                  // ligne vide
  ].join('\n');

  it('parse plusieurs transactions séparées par ^', () => {
    const { rows, invalid } = parseBankQif(sample);
    expect(invalid).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({
      label: 'VIR INST WERO',
      amount: -210,
    }));
    expect(rows[0].date.getUTCDate()).toBe(25);
    expect(rows[1].amount).toBe(-80);
  });

  it('ignore l\'en-tête !Type:Bank', () => {
    const { rows } = parseBankQif(sample);
    // Si l'en-tête n'était pas ignoré, on aurait un row "invalide" comptabilisé.
    expect(rows).toHaveLength(2);
  });

  it('utilise Memo en fallback si Payee absent', () => {
    const qif = [
      'D01/04/2026',
      'T-50.00',
      'MFallback Memo',
      '^',
    ].join('\n');
    const { rows } = parseBankQif(qif);
    expect(rows[0].label).toBe('Fallback Memo');
  });

  it('flush la dernière transaction même sans ^ final', () => {
    const qif = 'D01/04/2026\nT-50.00\nPSANS_TERMINATEUR';
    const { rows, invalid } = parseBankQif(qif);
    expect(rows).toHaveLength(1);
    expect(invalid).toBe(0);
    expect(rows[0].label).toBe('SANS_TERMINATEUR');
  });

  it('compte invalid quand date/montant/label manque', () => {
    const qif = [
      'D25/04/2026',
      // pas de T (montant) ni P (label)
      '^',
    ].join('\n');
    const { rows, invalid } = parseBankQif(qif);
    expect(rows).toHaveLength(0);
    expect(invalid).toBe(1);
  });

  it('décode Latin-1 si UTF-8 invalide', () => {
    // "PCARTE LIBELLÉ" avec É en latin1 (0xC9) — invalide en UTF-8 strict
    const buf = Buffer.concat([
      Buffer.from('D25/04/2026\nT-100\nPCARTE LIBELL', 'utf8'),
      Buffer.from([0xC9]),
      Buffer.from('\n^\n', 'utf8'),
    ]);
    const { rows } = parseBankQif(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('CARTE LIBELLÉ');
  });
});
