const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile');
const verifyToken = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/activity', verifyToken, profileController.getActivity);
router.put('/update', verifyToken, profileController.updateProfile);
router.post('/avatar', verifyToken, upload.single('avatar'), profileController.uploadAvatar);
router.put('/avatar/remove', verifyToken, profileController.removeAvatar);

module.exports = router;
