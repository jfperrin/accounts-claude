const multer = require('multer');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !process.env.MONGODB_URI;

// Dev  : stockage disque dans uploads/avatars/ (simple, pas de base64 en SQLite)
// Prod : stockage mémoire, converti en data URL Base64 persistée dans MongoDB
const storage = isDev
  ? (() => {
      const dir = path.join(__dirname, '..', 'uploads', 'avatars');
      fs.mkdirSync(dir, { recursive: true });
      return multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, dir),
        filename: (req, file, cb) => {
          const ext = file.mimetype.split('/')[1] || 'jpg';
          cb(null, `${req.user._id}_${Date.now()}.${ext}`);
        },
      });
    })()
  : multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: isDev ? 2 * 1024 * 1024 : 512 * 1024 }, // 2 MB dev / 512 KB prod
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seules les images sont acceptées'));
    }
    cb(null, true);
  },
});

module.exports = upload;
