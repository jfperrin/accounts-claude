const crypto = require('crypto');

// Code 6 chiffres pour le 2FA email. crypto.randomInt → distribution uniforme.
function generateEmailCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

// Recovery codes : alphabet sans ambiguïté visuelle (pas de i, l, o, 0, 1).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
// Rejet-réessai pour éviter le biais modulo : on ne garde que les octets sous le
// plus grand multiple de ALPHABET.length ≤ 256 (sinon certains symboles sont
// légèrement sur-représentés). Coût : ~3% d'octets jetés en moyenne.
const REJECT_THRESHOLD = 256 - (256 % ALPHABET.length);
function generateRecoveryCode() {
  const out = [];
  while (out.length < 10) {
    const buf = crypto.randomBytes(16);
    for (let i = 0; i < buf.length && out.length < 10; i++) {
      if (buf[i] < REJECT_THRESHOLD) out.push(ALPHABET[buf[i] % ALPHABET.length]);
    }
  }
  return out.join('');
}

function generateRecoveryCodes() {
  const set = new Set();
  while (set.size < 10) set.add(generateRecoveryCode());
  return [...set];
}

module.exports = { generateEmailCode, generateRecoveryCode, generateRecoveryCodes };
