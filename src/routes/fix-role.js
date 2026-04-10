const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Endpoint temporaire pour fixer le rôle d'un utilisateur
// POST /fix-role { email: "diallodev45@gmail.com", role: "ADMIN" }
router.post('/', async (req, res) => {
  try {
    const { email, role } = req.body;
    
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role required' });
    }
    
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Mettre à jour le rôle
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: role.toUpperCase() },
      select: { id: true, email: true, name: true, role: true }
    });
    
    console.log(`✅ Role updated: ${email} → ${role.toUpperCase()}`);
    res.json({ 
      success: true, 
      message: `Role updated for ${email}`,
      user: updatedUser 
    });
    
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /fix-role/check?email=diallodev45@gmail.com
router.get('/check', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
