require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const verifyToken = require('./src/middleware/auth');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Security & Logging middlewares
const {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  helmetConfig,
  sanitizeInput,
} = require('./src/middleware/security');
const { logger, morganStream } = require('./src/config/logger');

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

// Security middlewares
app.use(helmetConfig); // Headers sécurisés
app.use(cors());
app.use(compression()); // Compression gzip
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging HTTP avec Morgan + Winston
app.use(morgan('combined', { stream: morganStream }));

// Sanitization des entrées
app.use(sanitizeInput);

// Rate limiting général
app.use(generalLimiter);

// Exposer les fichiers uploadés publiquement
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes avec rate limiting spécifique
app.use('/auth', authLimiter, authRouter); // Limiter strict pour auth
app.use('/goals', goalsRouter);
app.use('/library', uploadLimiter, libraryRouter); // Limiter pour uploads
app.use('/conferences', conferenceRouter);
app.use('/dashboard', dashboardRouter);
app.use('/admin', adminRouter);
app.use('/profile', profileRouter);
app.use('/events', eventsRouter);
app.use('/notifications', notificationsRouter);
app.use('/agora', require('./src/routes/agora'));

// Public routes
app.get('/', (req, res) => {
  res.json({ 
    message: "BTS API is running!",
    version: '1.0.0',
    documentation: '/health',
  });
});

/// Health check détaillé avec monitoring
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  // Vérifier la connexion DB
  let dbStatus = 'ok';
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch (err) {
    dbStatus = 'error';
    logger.error('Database health check failed', err);
  }

  // Stats système
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  const health = {
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: {
        status: dbStatus,
        latency: `${dbLatency}ms`,
      },
      api: {
        status: 'ok',
        responseTime: `${Date.now() - startTime}ms`,
      },
    },
    system: {
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      },
    },
    features: {
      compression: true,
      rateLimiting: true,
      helmet: true,
      logging: true,
    },
  };

  const statusCode = dbStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Port listening (Version pour développement mobile)
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server is starting on http://0.0.0.0:${PORT}`);
    logger.info(`Mobile access: http://192.168.1.107:${PORT}`);
    logger.info(`Health check: http://0.0.0.0:${PORT}/health`);
    
    // Vérification de la base de données en arrière-plan
    prisma.$connect()
        .then(() => logger.info('✅ Database connected successfully.'))
        .catch((err) => {
            logger.error('❌ Database connection failed:', err);
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
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception thrown:', err);
    process.exit(1);
});

process.on('exit', (code) => {
    logger.info(`Process is exiting with code: ${code}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await prisma.$disconnect();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});
