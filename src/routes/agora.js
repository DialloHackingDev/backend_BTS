const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const agoraRecording = require('../services/agoraRecording');

const prisma = new PrismaClient();

/**
 * Vérifier la configuration Agora
 * GET /agora/status
 */
router.get('/status', (req, res) => {
  const isConfigured = agoraRecording.isConfigured();
  res.json({
    configured: isConfigured,
    appId: agoraRecording.appId ? '✅ Configuré' : '❌ Manquant',
    appCertificate: agoraRecording.appCertificate ? '✅ Configuré' : '❌ Manquant',
    customerId: agoraRecording.customerId ? '✅ Configuré' : '❌ Manquant',
    customerSecret: agoraRecording.customerSecret ? '✅ Configuré' : '❌ Manquant',
    message: isConfigured 
      ? 'Agora Cloud Recording est prêt' 
      : 'Configuration incomplète - Les enregistrements ne fonctionneront pas'
  });
});

/**
 * Démarrer l'enregistrement d'une conférence
 * POST /agora/recording/start
 */
router.post('/recording/start', verifyToken, async (req, res) => {
  try {
    const { conferenceId, channelName } = req.body;

    if (!conferenceId || !channelName) {
      return res.status(400).json({ error: 'conferenceId et channelName requis' });
    }

    // Vérifier si Agora est configuré
    if (!agoraRecording.isConfigured()) {
      return res.status(400).json({
        error: 'Configuration Agora incomplète',
        details: 'Les variables AGORA_CUSTOMER_ID et AGORA_CUSTOMER_SECRET sont requises pour le Cloud Recording'
      });
    }

    console.log(`Démarrage enregistrement pour conférence ${conferenceId}, channel ${channelName}`);

    const recording = await agoraRecording.startRecording(channelName, 999999);

    // Sauvegarder les infos d'enregistrement dans la conférence
    await prisma.conference.update({
      where: { id: parseInt(conferenceId) },
      data: {
        recordingResourceId: recording.resourceId,
        recordingSid: recording.sid,
        recordingUid: recording.uid,
        isRecording: true
      }
    });

    res.json({
      success: true,
      message: 'Enregistrement démarré',
      resourceId: recording.resourceId,
      sid: recording.sid
    });
  } catch (error) {
    console.error('Erreur démarrage enregistrement:', error);
    // Déterminer le statut HTTP (peut être 400 ou 500)
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      error: 'Erreur démarrage enregistrement',
      details: error.message,
      agoraError: error.agoraData || null
    });
  }
});

/**
 * Arrêter l'enregistrement
 * POST /agora/recording/stop
 */
router.post('/recording/stop', verifyToken, async (req, res) => {
  const { conferenceId } = req.body;

  if (!conferenceId) {
    return res.status(400).json({ error: 'conferenceId requis.' });
  }

  try {
    // Récupérer la conférence avec les infos d'enregistrement
    const conference = await prisma.conference.findUnique({
      where: { id: parseInt(conferenceId) }
    });

    if (!conference || !conference.isRecording) {
      return res.status(400).json({ error: 'Aucun enregistrement actif pour cette conférence.' });
    }

    // Arrêter l'enregistrement
    const result = await agoraRecording.stopRecording(
      conference.roomId,
      conference.recordingResourceId,
      conference.recordingSid,
      conference.recordingUid
    );

    // Extraire l'URL de la vidéo depuis la réponse
    const fileList = result.serverResponse?.fileList || [];
    const videoUrl = fileList.length > 0 ? fileList[0].fileName : null;

    // Mettre à jour la conférence
    await prisma.conference.update({
      where: { id: parseInt(conferenceId) },
      data: {
        isRecording: false,
        videoUrl: videoUrl,
        recordingStoppedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Enregistrement arrêté',
      videoUrl: videoUrl,
      fileList: fileList
    });
  } catch (error) {
    console.error('Erreur arrêt enregistrement:', error);
    res.status(500).json({
      error: 'Erreur arrêt enregistrement',
      details: error.message
    });
  }
});

/**
 * Statut de l'enregistrement
 * GET /agora/recording/:conferenceId/status
 */
router.get('/recording/:conferenceId/status', verifyToken, async (req, res) => {
  const { conferenceId } = req.params;

  try {
    const conference = await prisma.conference.findUnique({
      where: { id: parseInt(conferenceId) },
      select: {
        isRecording: true,
        recordingResourceId: true,
        recordingSid: true,
        videoUrl: true
      }
    });

    if (!conference) {
      return res.status(404).json({ error: 'Conférence non trouvée.' });
    }

    res.json({
      isRecording: conference.isRecording,
      hasRecording: !!conference.videoUrl,
      videoUrl: conference.videoUrl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Récupérer un token Agora
 * GET /agora/token
 */
router.get('/token', verifyToken, (req, res) => {
  const { channelName } = req.query;

  if (!channelName) {
    return res.status(400).json({ error: 'channelName requis.' });
  }

  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  // Si pas de certificate configuré → mode test sans token
  if (!appCertificate || appCertificate.trim() === '') {
    return res.json({
      token: null,
      appId,
      channelName,
      message: 'Mode test — App Certificate non configuré',
    });
  }

  try {
    const { RtcTokenBuilder, RtcRole } = require('agora-token');
    const uid = 0; // uid 0 = Agora assigne automatiquement
    const role = RtcRole.PUBLISHER;
    const expireTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpireTime,
      privilegeExpireTime
    );

    res.json({ token, appId, channelName, uid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
