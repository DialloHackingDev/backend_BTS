const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// ==================== RATE LIMITING ====================

/// Limiter général pour toutes les routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/// Limiter strict pour les routes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  skipSuccessfulRequests: true, // Ne pas compter les succès
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/// Limiter pour l'upload de fichiers
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 uploads max par heure
  message: {
    error: 'Quota d\'upload atteint, veuillez réessayer plus tard',
  },
});

// ==================== HELMET CONFIGURATION ====================

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Nécessaire pour certaines images
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: true,
});

// ==================== VALIDATION FICHIER ====================

const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/// Middleware de validation des fichiers
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next(); // Pas de fichier, continuer
  }

  const { mimetype, size } = req.file;

  // Vérifier le type MIME
  if (!ALLOWED_MIME_TYPES[mimetype]) {
    return res.status(400).json({
      error: 'Type de fichier non autorisé',
      allowedTypes: Object.keys(ALLOWED_MIME_TYPES),
    });
  }

  // Vérifier la taille
  if (size > MAX_FILE_SIZE) {
    return res.status(400).json({
      error: 'Fichier trop volumineux',
      maxSize: '50MB',
      receivedSize: `${(size / 1024 / 1024).toFixed(2)}MB`,
    });
  }

  next();
};

/// Middleware de sanitization des entrées
const sanitizeInput = (req, res, next) => {
  // Fonction de nettoyage basique
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Supprimer les balises HTML potentiellement dangereuses
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, ''); // onerror, onclick, etc.
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  // Nettoyer body, query et params
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  helmetConfig,
  validateFileUpload,
  sanitizeInput,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
