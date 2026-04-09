const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const agoraRecording = require('../services/agoraRecording');

const prisma = new PrismaClient();

/**
 * Démarrer l'enregistrement d'une conférence
 * POST /agora/recording/start
 */
router.post('/recording/start', verifyToken, async (req, res) => {
  const { conferenceId, channelName } = req.body;

  if (!conferenceId || !channelName) {
    return res.status(400).json({ error: 'conferenceId et channelName requis.' });
  }

  // Vérifier que l'enregistrement est configuré
  if (!agoraRecording.isConfigured()) {
    return res.status(503).json({
      error: 'Enregistrement non configuré.',
      message: 'AGORA_CUSTOMER_ID et AGORA_CUSTOMER_SECRET requis.'
    });
  }

  try {
    const recording = await agoraRecording.startRecording(channelName, 999999);

    // Sauvegarder les infos dans la conférence
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
    res.status(500).json({
      error: 'Erreur démarrage enregistrement',
      details: error.message
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
