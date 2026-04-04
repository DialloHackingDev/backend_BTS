const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadToStorage, deleteFromStorage } = require('../config/supabaseStorage');

const router = express.Router();
const prisma = new PrismaClient();

// Récupérer tous les contenus avec pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.library.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.library.count()
    ]);

    res.json({ data: items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload vers Firebase Storage
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  const { title } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier téléchargé.' });
  }

  try {
    // Déterminer le type par mimetype ET extension
    const mime = req.file.mimetype;
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let fileType = 'audio';
    if (mime.includes('pdf') || ext === 'pdf') fileType = 'pdf';
    else if (mime.includes('video') || ['mp4','mov','avi'].includes(ext)) fileType = 'video';
    else if (mime.includes('audio') || ['mp3','wav','m4a'].includes(ext)) fileType = 'audio';

    // Upload vers Supabase Storage
    const publicUrl = await uploadToStorage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'library'
    );

    const item = await prisma.library.create({
      data: {
        title: title || req.file.originalname,
        type: fileType,
        url: publicUrl,
      }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Modifier le titre d'une ressource
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Titre requis.' });
  try {
    const item = await prisma.library.update({
      where: { id: parseInt(id) },
      data: { title }
    });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supprimer une ressource (supprime aussi de Firebase)
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.library.findUnique({ where: { id: parseInt(id) } });
    if (item) {
      // Supprimer de Supabase si c'est une URL Supabase
      if (item.url && item.url.includes('supabase.co')) {
        await deleteFromStorage(item.url);
      }
      await prisma.library.delete({ where: { id: parseInt(id) } });
    }
    res.json({ message: 'Ressource supprimée avec succès' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
