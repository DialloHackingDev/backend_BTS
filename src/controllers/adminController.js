const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.getStats = async (req, res) => {
  try {
    // Calcul des dates pour comparaison
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
    
    // Statistiques actuelles
    const [totalUsers, totalLibraryItems, totalConferences, activeConferences] = await Promise.all([
      prisma.user.count(),
      prisma.library.count(),
      prisma.conference.count(),
      prisma.conference.count({ where: { status: 'ACTIVE' } }),
    ]);
    
    // Calcul de la croissance des utilisateurs
    const usersLastMonth = await prisma.user.count({
      where: { createdAt: { gte: oneMonthAgo, lt: now } }
    });
    const usersPreviousMonth = await prisma.user.count({
      where: { createdAt: { gte: twoMonthsAgo, lt: oneMonthAgo } }
    });
    const userGrowth = usersPreviousMonth > 0 
      ? Math.round(((usersLastMonth - usersPreviousMonth) / usersPreviousMonth) * 100)
      : usersLastMonth > 0 ? 100 : 0;
    
    // Nouveaux contenus ce mois
    const newContents = await prisma.library.count({
      where: { createdAt: { gte: oneMonthAgo } }
    });
    
    // Calcul du total des téléchargements (simulé basé sur les likes/interactions)
    const totalDownloads = await prisma.library.aggregate({
      _sum: { likes: true }
    });
    const downloadsLastMonth = await prisma.library.aggregate({
      where: { createdAt: { gte: oneMonthAgo } },
      _sum: { likes: true }
    });
    const totalDownloadsValue = totalDownloads._sum.likes || 0;
    const lastMonthDownloads = downloadsLastMonth._sum.likes || 0;
    
    // Heures de conférence estimées (10 minutes par conférence en moyenne)
    const conferenceMinutes = totalConferences * 10;
    const conferenceHours = Math.floor(conferenceMinutes / 60);
    const conferenceMinutesRemainder = conferenceMinutes % 60;
    
    res.json({
      totalUsers: { 
        value: totalUsers, 
        growth: userGrowth >= 0 ? `+${userGrowth}%` : `${userGrowth}%` 
      },
      activeCourses: { 
        value: totalLibraryItems, 
        growth: `+${newContents}` 
      },
      libraryDownloads: { 
        value: totalDownloadsValue >= 1000 
          ? `${(totalDownloadsValue / 1000).toFixed(1)}k` 
          : totalDownloadsValue.toString(), 
        growth: `+${lastMonthDownloads}` 
      },
      conferenceHours: { 
        value: conferenceHours > 0 
          ? `${conferenceHours}h${conferenceMinutesRemainder}` 
          : `${conferenceMinutes}min`,
        status: activeConferences > 0 ? 'Live' : 'Offline'
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
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
  try {
    // Générer les 7 derniers mois
    const months = [];
    const newUsers = [];
    const retention = [];
    
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
      
      // Nom du mois abrégé
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      months.push(monthNames[monthDate.getMonth()]);
      
      // Nouveaux utilisateurs ce mois
      const userCount = await prisma.user.count({
        where: {
          createdAt: {
            gte: monthDate,
            lt: nextMonth
          }
        }
      });
      newUsers.push(userCount);
      
      // Taux de rétention simulé (utilisateurs actifs ce mois / total des utilisateurs créés ce mois)
      // En réalité, on pourrait suivre les connexions
      const retentionRate = userCount > 0 ? Math.min(80, Math.max(15, 50 + Math.random() * 20)) : 0;
      retention.push(Math.round(retentionRate));
    }
    
    res.json({ months, newUsers, retention });
  } catch (error) {
    console.error('Engagement data error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

exports.getContentPortfolio = async (req, res) => {
  try {
    // Compter les contenus par type (basé sur le champ type de la bibliothèque)
    const [videoCourses, audioCoaching, pdfBlueprints, otherContents] = await Promise.all([
      prisma.library.count({ where: { type: { contains: 'video', mode: 'insensitive' } } }),
      prisma.library.count({ where: { type: { contains: 'audio', mode: 'insensitive' } } }),
      prisma.library.count({ where: { type: { contains: 'pdf', mode: 'insensitive' } } }),
      prisma.library.count({ 
        where: { 
          NOT: [
            { type: { contains: 'video', mode: 'insensitive' } },
            { type: { contains: 'audio', mode: 'insensitive' } },
            { type: { contains: 'pdf', mode: 'insensitive' } }
          ]
        } 
      })
    ]);
    
    const total = videoCourses + audioCoaching + pdfBlueprints + otherContents || 1; // Éviter division par zéro
    
    res.json({ 
      videoCourses: Math.round((videoCourses / total) * 100),
      audioCoaching: Math.round((audioCoaching / total) * 100), 
      pdfBlueprints: Math.round((pdfBlueprints / total) * 100),
      rawCounts: {
        video: videoCourses,
        audio: audioCoaching,
        pdf: pdfBlueprints,
        other: otherContents,
        total: videoCourses + audioCoaching + pdfBlueprints + otherContents
      }
    });
  } catch (error) {
    console.error('Content portfolio error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
