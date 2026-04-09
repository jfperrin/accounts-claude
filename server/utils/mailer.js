const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

async function sendPasswordResetEmail(to, resetUrl) {
  if (!resend) {
    // En dev sans clé configurée : log l'URL dans la console au lieu d'envoyer
    console.log(`[mailer] Reset URL pour ${to} : ${resetUrl}`);
    return;
  }
  await resend.emails.send({
    from: FROM,
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

module.exports = { sendPasswordResetEmail };
