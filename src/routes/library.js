const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
const prisma = new PrismaClient();

// Récupérer tous les contenus (PDF, Audio, Vidéo) avec pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.library.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.library.count()
    ]);

    res.json({ data: items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter une ressource (Upload de fichier)
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  const { title } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier téléchargé.' });
  }

  try {
    // On enregistre l'URL relative accessible via static express
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.includes('pdf') ? 'pdf' : 'audio';

    const item = await prisma.library.create({
      data: {
        title: title || req.file.originalname,
        type: fileType,
        url: fileUrl
      }
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supprimer une ressource
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.library.delete({
        where: { id: parseInt(id) }
      });
      res.json({ message: "Ressource supprimée avec succès" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

module.exports = router;
