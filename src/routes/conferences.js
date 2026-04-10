const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Sessions actives (non terminées)
router.get('/active', verifyToken, async (req, res) => {
  try {
    console.log(`[Conferences] Fetching active conferences for user: ${req.user?.userId || 'unknown'}`);
    
    // Test DB connection first
    await prisma.$queryRaw`SELECT 1`;
    
    const conferences = await prisma.conference.findMany({
      where: { endedAt: null },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`[Conferences] Found ${conferences.length} active conferences`);
    res.json(conferences);
  } catch (error) {
    console.error(`[Conferences] Error fetching active:`, error);
    console.error(`[Conferences] Error code:`, error.code);
    console.error(`[Conferences] Error meta:`, error.meta);
    res.status(500).json({ 
      error: 'Database error', 
      message: error.message,
      code: error.code,
      hint: 'Vérifiez que les migrations sont appliquées'
    });
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

    console.log(`[Conferences] Fetching history with filter: ${filter}, page: ${page}`);

    if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { gte: weekAgo } };
    } else if (filter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { gte: monthAgo } };
    }

    console.log(`[Conferences] Date filter:`, dateFilter);

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

    console.log(`[Conferences] Found ${conferences.length} conferences, total: ${total}`);
    res.json({ data: conferences, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(`[Conferences] Error fetching history:`, error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Terminer une conférence et enregistrer le lien vidéo
router.put('/:id/end', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { videoUrl } = req.body;
  try {
    // Marquer comme terminée
    const conference = await prisma.conference.update({
      where: { id: parseInt(id) },
      data: {
        videoUrl: videoUrl || null,
        endedAt: new Date(),
      }
    });

    // Si un lien vidéo est fourni, l'ajouter à la bibliothèque
    if (videoUrl && videoUrl.trim()) {
      const dateStr = new Date(conference.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
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
  console.log(`[Conferences] Creating conference - user: ${req.user.userId}, title: ${title}`);
  
  try {
    const roomId = `bts-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[Conferences] Generated roomId: ${roomId}`);
    
    const conference = await prisma.conference.create({
      data: {
        title: title || 'Salle BTS',
        roomId: roomId,
        userId: req.user.userId
      }
    });

    console.log(`[Conferences] Created conference: ${conference.id}`);
    res.status(201).json(conference);
  } catch (error) {
    console.error(`[Conferences] Error creating conference:`, error);
    res.status(400).json({ error: error.message, stack: error.stack });
  }
});

module.exports = router;
