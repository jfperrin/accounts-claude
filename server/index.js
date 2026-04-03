require('dotenv').config();
const connectDB = require('./config/db');
const createApp = require('./app');

connectDB().then(() => {
  const app = createApp(process.env.MONGODB_URI);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
});
