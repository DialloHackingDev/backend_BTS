const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const { PrismaClient } = require('@prisma/client');
const { uploadToStorage, deleteFromStorage } = require('../config/supabaseStorage');
const upload = require('../middleware/upload');

const prisma = new PrismaClient();

// Route secrète — promouvoir un admin via Postman
router.post('/promote', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Clé secrète invalide.' });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true }
    });
    res.json({ message: `✅ ${user.email} est maintenant ADMIN.`, user });
  } catch (error) {
    res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }
});

// Toutes les routes suivantes nécessitent token + rôle ADMIN
router.use(verifyToken, adminOnly);

// ── Stats & Dashboard ──────────────────────────────────────
router.get('/stats', adminController.getStats);
router.get('/engagement', adminController.getEngagementData);
router.get('/portfolio', adminController.getContentPortfolio);

// ── CRUD Utilisateurs ──────────────────────────────────────
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.put('/users/role', adminController.updateUserRole);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// ── Gestion des vidéos (hors conférences) ─────────────────
router.get('/videos', async (req, res) => {
  try {
    const videos = await prisma.library.findMany({
      where: { type: 'video', description: { not: { startsWith: 'conference:' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/videos', upload.single('file'), async (req, res) => {
  const { title } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Fichier requis.' });
  try {
    const publicUrl = await uploadToStorage(req.file.buffer, req.file.originalname, req.file.mimetype, 'videos');
    const video = await prisma.library.create({
      data: { title: title || req.file.originalname, type: 'video', url: publicUrl }
    });
    res.status(201).json({ video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/videos/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  try {
    const video = await prisma.library.update({
      where: { id: parseInt(id) },
      data: { title }
    });
    res.json({ video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/videos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const video = await prisma.library.findUnique({ where: { id: parseInt(id) } });
    if (video?.url?.includes('supabase.co')) await deleteFromStorage(video.url);
    await prisma.library.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Vidéo supprimée.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
