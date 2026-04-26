// Parser OFX (Open Financial Exchange) — gère les deux flavors :
//
//   OFX 1.x (SGML)            OFX 2.x (XML)
//   ─────────────────         ─────────────────
//   OFXHEADER:100             <?xml version="1.0"?>
//   DATA:OFXSGML              <?OFX OFXHEADER="200" ...?>
//   ENCODING:USASCII          <OFX>
//   ...                         <BANKMSGSRSV1>...
//                                 <STMTTRN>
//   <OFX>                           <TRNAMT>-210.00</TRNAMT>
//   <BANKMSGSRSV1>                  ...
//   <STMTTRN>                     </STMTTRN>
//   <TRNAMT>-210.00
//   <NAME>VIR INST WERO          ← OFX 2 ferme tous les tags
//   ...                          ← OFX 1 ne les ferme pas (SGML)
//
// Plutôt que d'utiliser un parser XML complet (qui plante sur OFX 1 SGML),
// on fait du regex léger : on isole chaque bloc <STMTTRN>...</STMTTRN> ou
// jusqu'au prochain <STMTTRN>, puis on extrait les tags utiles avec un regex
// qui accepte les deux formes (avec ou sans tag fermant).
//
// FITID (identifiant unique de transaction) est extrait mais pas encore
// utilisé pour la dédup : on continue à matcher sur label|bankId|amount|date.
// Une amélioration future serait de stocker fitId sur Operation et de l'utiliser
// pour une dédup parfaite (ce qui est l'avantage théorique majeur d'OFX).

const { parseAmount } = require('./parseHelpers');

function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (_) {
    return buf.toString('latin1');
  }
}

// Extrait la valeur d'un tag SGML/XML : <TAG>valeur ou <TAG>valeur</TAG>.
// On s'arrête au premier '<' ou retour à la ligne (typique OFX 1 SGML où
// chaque champ est sur sa propre ligne).
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

// Parse une date OFX au format YYYYMMDD ou YYYYMMDDhhmmss[.xxx][TZ].
// On garde uniquement les 8 premiers chiffres (date sans heure) puisqu'on
// stocke les opérations à la journée près.
function parseOfxDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse un buffer/string OFX en lignes d'opérations bancaires normalisées.
 *
 * @param {Buffer|string} input
 * @returns {{ rows: Array<{ label, amount, date, fitId }>, invalid: number }}
 */
function parseBankOfx(input) {
  let text = Buffer.isBuffer(input) ? decodeBuffer(input) : String(input);
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Tronque l'en-tête (header SGML "key:value" ou directives XML) jusqu'au
  // premier <OFX>. Si <OFX> est absent, on essaie quand même : certains
  // exporteurs émettent directement <BANKMSGSRSV1> sans wrapper <OFX>.
  const ofxStart = text.search(/<OFX>/i);
  if (ofxStart > 0) text = text.slice(ofxStart);

  // Découpe en blocs <STMTTRN>...</STMTTRN> ou <STMTTRN>...<STMTTRN suivant>.
  // [\s\S] matche aussi les retours à la ligne (DOTALL n'existe pas en JS sans flag).
  // Le lookahead positif arrête la capture au prochain délimiteur sans le consommer.
  const blockRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRN>|<\/BANKTRANLIST>|$)/gi;
  const rows = [];
  let invalid = 0;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[1];
    const date = parseOfxDate(extractTag(block, 'DTPOSTED'));
    // OFX utilise toujours '.' comme séparateur décimal, mais parseAmount gère
    // les deux conventions par sécurité (certains exporteurs européens trichent).
    const amount = parseAmount(extractTag(block, 'TRNAMT'));
    // NAME est le libellé principal ; MEMO sert de fallback (certains exports
    // mettent tout dans MEMO et laissent NAME vide).
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');
    const label = (name && name.length > 0) ? name : (memo || '');
    const fitId = extractTag(block, 'FITID');

    if (!date || !label || amount == null || amount === 0) {
      invalid++;
      continue;
    }
    rows.push({ label, amount, date, fitId });
  }
  return { rows, invalid };
}

module.exports = { parseBankOfx };
