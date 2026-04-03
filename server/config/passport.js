const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');

module.exports = function configurePassport(db) {
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await db.users.findByUsername(username);
      if (!user) return done(null, false, { message: 'Utilisateur introuvable' });
      if (!user.passwordHash) return done(null, false, { message: 'Ce compte utilise la connexion Google' });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: 'Mot de passe incorrect' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        let user = await db.users.findByGoogleId(profile.id);
        if (user) return done(null, user);

        const email = profile.emails?.[0]?.value;
        let username = email || profile.displayName;
        if (await db.users.usernameExists(username)) username = `${username}_${profile.id.slice(-6)}`;

        user = await db.users.create({ googleId: profile.id, username, email });
        done(null, user);
      } catch (err) {
        done(err);
      }
    }));
  }

  passport.serializeUser((user, done) => done(null, String(user._id)));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.users.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
