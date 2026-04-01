const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dashboard Stats
exports.getStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeCourses = await prisma.library.count({ where: { type: 'course' } }); // Suivant votre logique future
    const totalLibraryItems = await prisma.library.count();
    const totalConferences = await prisma.conference.count();

    // Simulation de données de croissance pour le dashboard (+12%, etc.)
    res.json({
      totalUsers: { value: totalUsers, growth: '+12%' },
      activeCourses: { value: activeCourses || 84, growth: '+3' },
      libraryDownloads: { value: '45.2k', growth: '+2.4k' },
      conferenceHours: { value: totalConferences * 10 || '1,240', status: 'Live' },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// User Management
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      }
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateUserRole = async (req, res) => {
  const { userId, role } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role }
    });
    res.json({ message: 'User role updated', user });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Engagement Data (Simulation pour le graphique)
exports.getEngagementData = async (req, res) => {
  // En production, on calculerait cela par mois
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'];
  const newUsers = [30, 45, 35, 50, 40, 60, 85];
  const retention = [20, 25, 22, 30, 28, 35, 40];

  res.json({ months, newUsers, retention });
};

// Portfolio Data
exports.getContentPortfolio = async (req, res) => {
  res.json({
    videoCourses: 65,
    audioCoaching: 20,
    pdfBlueprints: 15
  });
};
