require('dotenv').config();
const express = require('express');
const cors = require('cors');
const verifyToken = require('./src/middleware/auth');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const goalsRouter = require('./src/routes/goals');
const libraryRouter = require('./src/routes/library');
const conferenceRouter = require('./src/routes/conferences');
const dashboardRouter = require('./src/routes/dashboard');
const authRouter = require('./src/routes/auth');
const adminRouter = require('./src/routes/admin');
const profileRouter = require('./src/routes/profile');
const eventsRouter = require('./src/routes/events');
const notificationsRouter = require('./src/routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Exposer les fichiers uploadés publiquement
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/goals', goalsRouter);
app.use('/library', libraryRouter);
app.use('/conferences', conferenceRouter);
app.use('/dashboard', dashboardRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/profile', profileRouter);
app.use('/events', eventsRouter);
app.use('/notifications', notificationsRouter);
app.use('/agora', require('./src/routes/agora'));

// Public routes
app.get('/', (req, res) => {
  res.json({ message: "BTS API is running!" });
});

app.get('/health', (req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// Port listening (Version standard)
const server = app.listen(PORT, () => {
    console.log(`🚀 Server is starting on http://localhost:${PORT}`);
    
    // Vérification de la base de données en arrière-plan
    prisma.$connect()
        .then(() => console.log('✅ Database connected successfully.'))
        .catch((err) => {
            console.error('❌ Database connection failed:', err);
            // On ne ferme pas le serveur pour permettre le debug via l'API
        });
});

// Empêche Node.js de fermer le processus tant que le serveur est actif
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use.`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});

// Robustesse du cycle de vie
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
    process.exit(1);
});

process.on('exit', (code) => {
    console.log(`Process is exiting with code: ${code}`);
});
