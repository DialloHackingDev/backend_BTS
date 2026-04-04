const multer = require('multer');
const path = require('path');

// memoryStorage : fichier en mémoire (buffer) pour l'envoyer à Firebase
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('Upload reçu - mimetype:', file.mimetype, '| originalname:', file.originalname);
  const allowedTypes = [
    'application/pdf',
    'audio/mpeg', 'audio/wav', 'audio/mp3',
    'video/mp4',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf', '.mp3', '.wav', '.mp4'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Format non supporté: ${file.mimetype} (${ext})`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 Mo
});

module.exports = upload;
