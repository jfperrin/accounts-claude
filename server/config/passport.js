// Configuration des stratégies d'authentification Passport.
// Exportée sous forme de fonction (configurePassport(db)) pour recevoir
// les repos de la base de données active (SQLite ou MongoDB) sans couplage direct.

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');

module.exports = function configurePassport(db) {

  // --- Stratégie locale (email / password) ---
  // Passport appelle cette fonction à chaque POST /api/auth/login.
  // On cherche l'utilisateur par email, vérifie l'existence d'un hash
  // (les comptes Google n'ont pas de mot de passe), puis compare avec bcrypt.
  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await db.users.findByEmail(email);
      if (!user) return done(null, false, { message: 'Utilisateur introuvable' });
      if (!user.passwordHash) return done(null, false, { message: 'Ce compte utilise la connexion Google' });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: 'Mot de passe incorrect' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  // --- Stratégie Google OAuth 2.0 (optionnelle) ---
  // Activée uniquement si GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont définis.
  // Flux : Google redirige vers /api/auth/google/callback avec un code
  // → Passport échange le code contre un profil → on cherche ou crée l'utilisateur.
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      proxy: true,
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Première tentative : utilisateur déjà connu via Google
        let user = await db.users.findByGoogleId(profile.id);
        if (user) return done(null, user);

        // Nouvel utilisateur Google : on crée le compte avec l'email du profil.
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: 'Aucune adresse email fournie par Google' });

        user = await db.users.create({ googleId: profile.id, email });
        done(null, user);
      } catch (err) {
        done(err);
      }
    }));
  }

  // --- Sérialisation de session ---
  // serializeUser : stocke uniquement l'ID en session (payload minimal dans le cookie).
  // deserializeUser : à chaque requête, recharge l'objet user complet depuis la DB
  //   → req.user est disponible dans toutes les routes protégées.
  // String(user._id) unifie ObjectId (MongoDB) et UUID string (SQLite).
  passport.serializeUser((user, done) => done(null, String(user._id)));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.users.findById(id); // retourne sans passwordHash
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
