const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

const router = express.Router();
const prisma = new PrismaClient();

// GET historique des notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST envoyer une notification (admin uniquement)
router.post('/send', verifyToken, adminOnly, async (req, res) => {
  const { title, message, targetAll, targetIds } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Titre et message requis.' });
  }
  try {
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        sentBy: req.user.userId,
        targetAll: targetAll !== false,
        targetIds: targetIds ? JSON.stringify(targetIds) : null,
      },
    });

    // Récupérer les destinataires
    let recipients = [];
    if (targetAll !== false) {
      recipients = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
      });
    } else if (targetIds && targetIds.length > 0) {
      recipients = await prisma.user.findMany({
        where: { id: { in: targetIds.map(Number) } },
        select: { id: true, name: true, email: true }
      });
    }

    res.status(201).json({
      notification,
      sentTo: recipients.length,
      recipients: recipients.map(r => r.name),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
