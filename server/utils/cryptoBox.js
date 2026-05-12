// AES-256-GCM. Clé hex 32 bytes dans MFA_ENCRYPTION_KEY.
// Format de sortie : "v1:<iv-hex>:<ciphertext-hex>:<tag-hex>"
// La clé est lue à chaque appel pour permettre la mutation de process.env entre tests.

const crypto = require('crypto');

function getKey() {
  const hex = process.env.MFA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('MFA_ENCRYPTION_KEY manquant ou invalide (attendu 64 chars hex)');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`;
}

function decrypt(token) {
  const parts = token.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Format token invalide');
  const [, ivHex, ctHex, tagHex] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
