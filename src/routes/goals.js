const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Tous les objectifs de l'utilisateur connecté (avec pagination)
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goal.count({ where: { userId: req.user.userId } })
    ]);

    res.json({ data: goals, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un objectif
router.post('/', verifyToken, async (req, res) => {
  const { title, description, dueDate } = req.body;
  try {
    const goal = await prisma.goal.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: req.user.userId
      }
    });
    res.status(201).json(goal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Modifier un objectif
router.put('/:id', verifyToken, );

// Supprimer un objectif
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.goal.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Goal deleted" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
