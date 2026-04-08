const winston = require('winston');
const path = require('path');

// Configuration des niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Couleurs associées aux niveaux
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
};

winston.addColors(colors);

// Format pour la console (développement)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Format pour les fichiers (production)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

/// Transport pour les logs d'erreur
const errorTransport = new winston.transports.File({
  filename: path.join(__dirname, '../../logs/error.log'),
  level: 'error',
  format: fileFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

/// Transport pour tous les logs
const combinedTransport = new winston.transports.File({
  filename: path.join(__dirname, '../../logs/combined.log'),
  format: fileFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

/// Transport pour les requêtes HTTP
const httpTransport = new winston.transports.File({
  filename: path.join(__dirname, '../../logs/http.log'),
  level: 'http',
  format: fileFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

// Créer le logger
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console en développement
    ...(process.env.NODE_ENV !== 'production'
      ? [new winston.transports.Console({ format: consoleFormat })]
      : []),
    // Fichiers en production
    ...(process.env.NODE_ENV === 'production'
      ? [errorTransport, combinedTransport, httpTransport]
      : []),
  ],
  exitOnError: false,
});

/// Stream pour Morgan (intégration Express)
const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/// Helper pour logger les erreurs avec contexte
const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

/// Helper pour logger les requêtes API
const logApiRequest = (req, res, duration) => {
  logger.http({
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
};

module.exports = {
  logger,
  morganStream,
  logError,
  logApiRequest,
};
