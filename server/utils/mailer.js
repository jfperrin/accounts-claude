const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = 'jf@perrin.at';

async function send({ to, subject, html }) {
  if (!resend) {
    console.log(`[mailer] ${subject} → ${to}`);
    const urls = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    if (urls.length) console.log(`[mailer] URL: ${urls[0]}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

async function sendPasswordResetEmail(to, resetUrl) {
  await send({
    to,
    subject: 'Réinitialisation de votre mot de passe — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien expire dans <strong>1 heure</strong>.</p>
      <p>Si vous n'avez pas demandé cette action, ignorez cet email.</p>
    `,
  });
}

async function sendVerificationEmail(to, verifyUrl) {
  await send({
    to,
    subject: 'Confirmez votre adresse email — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Merci de vous être inscrit. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.</p>
      <p><a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Confirmer mon email</a></p>
      <p>Ce lien expire dans <strong>24 heures</strong>.</p>
      <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
    `,
  });
}

async function sendEmailChangeEmail(to, verifyUrl) {
  await send({
    to,
    subject: 'Confirmez votre nouvelle adresse email — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à changer votre adresse email. Cliquez sur le bouton ci-dessous pour confirmer.</p>
      <p><a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Confirmer mon nouvel email</a></p>
      <p>Ce lien expire dans <strong>24 heures</strong>.</p>
      <p>Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
    `,
  });
}

async function sendPasswordChangeEmail(to, cancelUrl) {
  await send({
    to,
    subject: 'Votre mot de passe a été modifié — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Le mot de passe de votre compte a été modifié.</p>
      <p>Si vous êtes à l'origine de ce changement, ignorez cet email.</p>
      <p>Dans le cas contraire, annulez le changement en cliquant ci-dessous :</p>
      <p><a href="${cancelUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Annuler le changement de mot de passe</a></p>
      <p>Ce lien expire dans <strong>12 heures</strong>.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail, sendEmailChangeEmail, sendPasswordChangeEmail };
