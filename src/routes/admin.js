const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

// Toutes les routes admin sont protégées par Token + Role
router.use(verifyToken, adminOnly);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getAllUsers);
router.put('/users/role', adminController.updateUserRole);
router.get('/engagement', adminController.getEngagementData);
router.get('/portfolio', adminController.getContentPortfolio);

module.exports = router;
