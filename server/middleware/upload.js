const multer = require('multer');

// Stockage en mémoire — le buffer est ensuite converti en data URL Base64
// et persisté dans MongoDB/SQLite. Aucun fichier écrit sur disque.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 }, // 512 KB max (stocké inline en base)
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seules les images sont acceptées'));
    }
    cb(null, true);
  },
});

module.exports = upload;
