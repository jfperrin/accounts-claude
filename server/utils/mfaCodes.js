const crypto = require('crypto');

// Code 6 chiffres pour le 2FA email. crypto.randomInt → distribution uniforme.
function generateEmailCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

// Recovery codes : alphabet sans ambiguïté visuelle (pas de i, l, o, 0, 1).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function generateRecoveryCode() {
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function generateRecoveryCodes() {
  const set = new Set();
  while (set.size < 10) set.add(generateRecoveryCode());
  return [...set];
}

module.exports = { generateEmailCode, generateRecoveryCode, generateRecoveryCodes };
