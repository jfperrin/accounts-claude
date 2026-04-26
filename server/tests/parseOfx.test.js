// Tests unitaires du parser OFX (SGML 1.x et XML 2.x).

const { parseBankOfx } = require('../utils/parseOfx');

describe('parseBankOfx', () => {
  // Format OFX 1.x SGML : header key:value puis tags non fermés
  const ofxSgml = [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    'ENCODING:USASCII',
    '',
    '<OFX>',
    '<BANKMSGSRSV1>',
    '<STMTTRNRS>',
    '<STMTRS>',
    '<BANKTRANLIST>',
    '<STMTTRN>',
    '<TRNTYPE>DEBIT',
    '<DTPOSTED>20260425000000',
    '<TRNAMT>-210.00',
    '<FITID>FT2026114801234',
    '<NAME>VIR INST WERO CAMILLE',
    '<STMTTRN>',
    '<TRNTYPE>CREDIT',
    '<DTPOSTED>20260420',
    '<TRNAMT>1500.00',
    '<FITID>FT2026114801235',
    '<NAME>SALAIRE',
    '</BANKTRANLIST>',
    '</STMTRS>',
    '</STMTTRNRS>',
    '</BANKMSGSRSV1>',
    '</OFX>',
  ].join('\n');

  it('parse OFX 1.x SGML (tags non fermés) et tronque le header', () => {
    const { rows, invalid } = parseBankOfx(ofxSgml);
    expect(invalid).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({
      label: 'VIR INST WERO CAMILLE',
      amount: -210,
      fitId: 'FT2026114801234',
    }));
    expect(rows[1].amount).toBe(1500);
    expect(rows[1].fitId).toBe('FT2026114801235');
  });

  it('parse correctement la date YYYYMMDD[hhmmss]', () => {
    const { rows } = parseBankOfx(ofxSgml);
    expect(rows[0].date.getUTCFullYear()).toBe(2026);
    expect(rows[0].date.getUTCMonth()).toBe(3); // avril
    expect(rows[0].date.getUTCDate()).toBe(25);
  });

  // Format OFX 2.x XML strict
  const ofxXml = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260425</DTPOSTED>
            <TRNAMT>-42.50</TRNAMT>
            <FITID>X1</FITID>
            <NAME>CARTE PHARMACIE</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

  it('parse OFX 2.x XML (tags fermés)', () => {
    const { rows } = parseBankOfx(ofxXml);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('CARTE PHARMACIE');
    expect(rows[0].amount).toBe(-42.5);
    expect(rows[0].fitId).toBe('X1');
  });

  it('utilise MEMO en fallback si NAME absent', () => {
    const ofx = `<OFX><STMTTRN>
<DTPOSTED>20260425
<TRNAMT>-10.00
<MEMO>Memo only
</STMTTRN></OFX>`;
    const { rows } = parseBankOfx(ofx);
    expect(rows[0].label).toBe('Memo only');
  });

  it('compte invalid quand date/montant/label manque', () => {
    const ofx = `<OFX><STMTTRN>
<TRNAMT>-10.00
</STMTTRN></OFX>`;
    const { rows, invalid } = parseBankOfx(ofx);
    expect(rows).toHaveLength(0);
    expect(invalid).toBe(1);
  });
});
