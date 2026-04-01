const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Récupérer toutes les conférences (historique complet)
router.get('/active', verifyToken, async (req, res) => {
  try {
    const conferences = await prisma.conference.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(conferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historique des conférences avec filtre par période + pagination
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { filter } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    let dateFilter = {};

    if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { gte: weekAgo } };
    } else if (filter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { gte: monthAgo } };
    }

    const [conferences, total] = await Promise.all([
      prisma.conference.findMany({
        where: dateFilter,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conference.count({ where: dateFilter })
    ]);

    res.json({ data: conferences, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Terminer une conférence et enregistrer le lien vidéo
router.put('/:id/end', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { videoUrl } = req.body;
  try {
    const conference = await prisma.conference.update({
      where: { id: parseInt(id) },
      data: { videoUrl: videoUrl || null }
    });

    // Si un lien vidéo est fourni, on l'ajoute automatiquement à la bibliothèque
    if (videoUrl && videoUrl.trim()) {
      const dateStr = new Date(conference.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      // Vérifier si une entrée existe déjà pour cette conférence
      const existing = await prisma.library.findFirst({
        where: { description: `conference:${conference.id}` }
      });
      if (!existing) {
        await prisma.library.create({
          data: {
            title: conference.title,
            description: `conference:${conference.id}`,
            type: 'video',
            url: videoUrl.trim(),
            category: dateStr,
          }
        });
      } else {
        await prisma.library.update({
          where: { id: existing.id },
          data: { url: videoUrl.trim() }
        });
      }
    }

    res.json(conference);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supprimer la vidéo d'une conférence (admin uniquement)
router.delete('/:id/video', verifyToken, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin uniquement.' });
  }
  const { id } = req.params;
  try {
    // Supprimer l'entrée library associée
    await prisma.library.deleteMany({
      where: { description: `conference:${id}` }
    });
    // Retirer le videoUrl de la conférence
    const conference = await prisma.conference.update({
      where: { id: parseInt(id) },
      data: { videoUrl: null }
    });
    res.json({ message: 'Vidéo supprimée.', conference });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Créer une nouvelle salle de conférence (tous les utilisateurs connectés)
router.post('/', verifyToken, async (req, res) => {
  const { title } = req.body;
  try {
    const conference = await prisma.conference.create({
      data: {
        title: title || 'Salle BTS',
        roomId: `bts-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: req.user.userId
      }
    });

    res.status(201).json(conference);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
