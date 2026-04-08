const { body, param, validationResult } = require('express-validator');

/// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// ==================== AUTH VALIDATORS ====================

const registerValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email trop long (max 255 caractères)'),
  
  body('password')
    .notEmpty().withMessage('Mot de passe requis')
    .isLength({ min: 6 }).withMessage('Mot de passe trop court (min 6 caractères)')
    .isLength({ max: 128 }).withMessage('Mot de passe trop long (max 128 caractères)'),
  
  body('name')
    .trim()
    .notEmpty().withMessage('Nom requis')
    .isLength({ min: 2 }).withMessage('Nom trop court (min 2 caractères)')
    .isLength({ max: 100 }).withMessage('Nom trop long (max 100 caractères)')
    .matches(/^[a-zA-Z\s\-']+$/).withMessage('Nom contient des caractères invalides'),
  
  handleValidationErrors,
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Email invalide')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Mot de passe requis'),
  
  handleValidationErrors,
];

// ==================== GOALS VALIDATORS ====================

const createGoalValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Titre requis')
    .isLength({ min: 2 }).withMessage('Titre trop court (min 2 caractères)')
    .isLength({ max: 200 }).withMessage('Titre trop long (max 200 caractères)')
    .escape(), // Échapper les caractères HTML
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description trop longue (max 1000 caractères)')
    .escape(),
  
  body('completed')
    .optional()
    .isBoolean().withMessage('Statut de completion doit être un booléen'),
  
  handleValidationErrors,
];

const updateGoalValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de goal invalide'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2 }).withMessage('Titre trop court')
    .isLength({ max: 200 }).withMessage('Titre trop long')
    .escape(),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description trop longue')
    .escape(),
  
  body('completed')
    .optional()
    .isBoolean().withMessage('Statut doit être un booléen'),
  
  handleValidationErrors,
];

const goalIdValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de goal invalide'),
  handleValidationErrors,
];

// ==================== LIBRARY VALIDATORS ====================

const createLibraryValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Titre requis')
    .isLength({ min: 2, max: 200 }).withMessage('Titre doit faire entre 2 et 200 caractères')
    .escape(),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description trop longue')
    .escape(),
  
  body('type')
    .notEmpty().withMessage('Type requis')
    .isIn(['pdf', 'audio', 'video', 'doc', 'other']).withMessage('Type invalide'),
  
  handleValidationErrors,
];

const updateLibraryValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID invalide'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Titre invalide')
    .escape(),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description trop longue')
    .escape(),
  
  handleValidationErrors,
];

// ==================== ADMIN VALIDATORS ====================

const createUserValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Email invalide')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Mot de passe requis')
    .isLength({ min: 6 }).withMessage('Mot de passe trop court'),
  
  body('name')
    .trim()
    .notEmpty().withMessage('Nom requis')
    .isLength({ min: 2, max: 100 }).withMessage('Nom invalide'),
  
  body('role')
    .optional()
    .isIn(['USER', 'ADMIN']).withMessage('Rôle doit être USER ou ADMIN'),
  
  handleValidationErrors,
];

const updateUserRoleValidator = [
  body('userId')
    .isInt({ min: 1 }).withMessage('ID utilisateur invalide'),
  
  body('role')
    .notEmpty().withMessage('Rôle requis')
    .isIn(['USER', 'ADMIN']).withMessage('Rôle doit être USER ou ADMIN'),
  
  handleValidationErrors,
];

const userIdValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID utilisateur invalide'),
  handleValidationErrors,
];

// ==================== PAGINATION VALIDATOR ====================

const paginationValidator = [
  body('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page doit être un entier positif'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit doit être entre 1 et 100'),
  
  handleValidationErrors,
];

module.exports = {
  // Auth
  registerValidator,
  loginValidator,
  
  // Goals
  createGoalValidator,
  updateGoalValidator,
  goalIdValidator,
  
  // Library
  createLibraryValidator,
  updateLibraryValidator,
  
  // Admin
  createUserValidator,
  updateUserRoleValidator,
  userIdValidator,
  
  // Pagination
  paginationValidator,
  
  // Generic
  handleValidationErrors,
};
