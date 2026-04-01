const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Récupérer les statistiques de progression
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const totalGoals = await prisma.goal.count({
      where: { userId: req.user.userId }
    });

    const completedGoals = await prisma.goal.count({
      where: { userId: req.user.userId, status: 'completed' }
    });

    const percentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

    res.json({ total: totalGoals, completed: completedGoals, percentage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
