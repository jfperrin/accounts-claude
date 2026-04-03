require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { MongoStore } = require('connect-mongo');
const cors = require('cors');
const connectDB = require('./config/db');
require('./config/passport');

const requireAuth = require('./middleware/requireAuth');
const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/banks', requireAuth, require('./routes/banks'));
app.use('/api/recurring-operations', requireAuth, require('./routes/recurringOperations'));
app.use('/api/periods', requireAuth, require('./routes/periods'));
app.use('/api/operations', requireAuth, require('./routes/operations'));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur serveur' });
});

connectDB().then(() => {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
});
