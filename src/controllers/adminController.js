const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalLibraryItems, totalConferences] = await Promise.all([
      prisma.user.count(),
      prisma.library.count(),
      prisma.conference.count(),
    ]);
    res.json({
      totalUsers: { value: totalUsers, growth: '+12%' },
      activeCourses: { value: totalLibraryItems, growth: '+3' },
      libraryDownloads: { value: '45.2k', growth: '+2.4k' },
      conferenceHours: { value: totalConferences * 10 || '1,240', status: 'Live' },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, createdAt: true }
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé.' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name || email.split('@')[0], email, password: hashed, role: role || 'USER' },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true }
    });
    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, status } = req.body;
  try {
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (status) data.status = status;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  try {
    await prisma.goal.deleteMany({ where: { userId: parseInt(id) } });
    await prisma.conference.updateMany({ where: { userId: parseInt(id) }, data: { userId: null } });
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Utilisateur supprimé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  const { userId, role } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role }
    });
    res.json({ message: 'Role updated', user });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getEngagementData = async (req, res) => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'];
  const newUsers = [30, 45, 35, 50, 40, 60, 85];
  const retention = [20, 25, 22, 30, 28, 35, 40];
  res.json({ months, newUsers, retention });
};

exports.getContentPortfolio = async (req, res) => {
  res.json({ videoCourses: 65, audioCoaching: 20, pdfBlueprints: 15 });
};
