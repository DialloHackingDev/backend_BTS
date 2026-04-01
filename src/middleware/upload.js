const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  console.log('Upload reçu - mimetype:', file.mimetype, '| originalname:', file.originalname);
  const allowedTypes = [
    'application/pdf',
    'audio/mpeg', 'audio/wav',
    'video/mp4',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf', '.mp3', '.wav', '.mp4'];
  const ext = require('path').extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Format non supporté: ${file.mimetype} (${ext})`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

module.exports = upload;
