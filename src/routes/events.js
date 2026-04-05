const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

const router = express.Router();
const prisma = new PrismaClient();

// GET tous les événements (tous les utilisateurs)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    let where = {};

    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where = { startDate: { gte: start, lte: end } };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET événements d'une plage de dates
router.get('/range', verifyToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    const events = await prisma.event.findMany({
      where: {
        startDate: { gte: new Date(start) },
        endDate: { lte: new Date(end) },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST créer un événement (admin uniquement)
router.post('/', verifyToken, adminOnly, async (req, res) => {
  const { title, description, type, startDate, endDate, conferenceId } = req.body;
  if (!title || !startDate || !endDate) {
    return res.status(400).json({ error: 'Titre, date début et date fin requis.' });
  }
  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        type: type || 'general',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        conferenceId: conferenceId ? parseInt(conferenceId) : null,
        createdBy: req.user.userId,
      },
    });
    res.status(201).json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT modifier un événement (admin uniquement)
router.put('/:id', verifyToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { title, description, type, startDate, endDate, conferenceId } = req.body;
  try {
    const event = await prisma.event.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        type,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        conferenceId: conferenceId ? parseInt(conferenceId) : null,
      },
    });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE supprimer un événement (admin uniquement)
router.delete('/:id', verifyToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.event.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Événement supprimé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
