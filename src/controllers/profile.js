const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getActivity = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [goals, conferences] = await Promise.all([
      prisma.goal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, createdAt: true }
      }),
      prisma.conference.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, createdAt: true }
      }),
    ]);

    const activities = [
      ...goals.map(g => ({
        type: 'goal',
        title: g.status === 'completed' ? `Objectif terminé : ${g.title}` : `Objectif créé : ${g.title}`,
        date: g.createdAt,
        icon: g.status === 'completed' ? 'check_circle' : 'flag',
      })),
      ...conferences.map(c => ({
        type: 'conference',
        title: `Conférence créée : ${c.title}`,
        date: c.createdAt,
        icon: 'video_call',
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

    res.json({ activities });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis.' });
    }
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie.' });
    }

    const { uploadToStorage } = require('../config/supabaseStorage');
    const avatarUrl = await uploadToStorage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'avatars'
    );

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.removeAvatar = async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { avatarUrl: null },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
