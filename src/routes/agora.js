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

    // Vérifier si un enregistrement est déjà en cours pour cette conférence
    const existingConference = await prisma.conference.findUnique({
      where: { id: parseInt(conferenceId) },
      select: { isRecording: true, recordingResourceId: true, recordingSid: true }
    });
    
    if (existingConference?.isRecording) {
      console.log(`⚠️ Enregistrement déjà en cours pour conférence ${conferenceId}, tentative d'arrêt...`);
      try {
        // Essayer d'arrêter l'ancien enregistrement
        await agoraRecording.stopRecording(
          channelName,
          existingConference.recordingResourceId,
          existingConference.recordingSid,
          999999
        );
        console.log('✅ Ancien enregistrement arrêté');
        // Attendre un peu pour que Agora libère le canal
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (stopError) {
        console.log('⚠️ Impossible d\'arrêter l\'ancien enregistrement:', stopError.message);
        // Continuer quand même, on va essayer avec un nouvel UID
      }
    }
    
    console.log(`Démarrage enregistrement pour conférence ${conferenceId}, channel ${channelName}`);
    
    // Générer un UID unique pour éviter les conflits (entre 100000 et 999999)
    const recordingUid = Math.floor(Math.random() * 900000) + 100000;
    
    const recording = await agoraRecording.startRecording(channelName, recordingUid);

    // Sauvegarder les infos d'enregistrement dans la conférence
    await prisma.conference.update({
      where: { id: parseInt(conferenceId) },
      data: {
        recordingResourceId: recording.resourceId,
        recordingSid: recording.sid,
        recordingUid: recordingUid, // Utiliser l'UID généré
        isRecording: true
      }
    });

    res.json({
      success: true,
      message: 'Enregistrement démarré',
      resourceId: recording.resourceId,
      sid: recording.sid,
      uid: recordingUid
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

    // Si l'enregistrement était déjà arrêté (worker crashed/auto-stop)
    if (result.alreadyStopped) {
      console.log('⚠️ Enregistrement déjà arrêté automatiquement');
    }
    
    // Essayer de récupérer les fichiers via query API (important en mode sans S3)
    let fileList = result.serverResponse?.fileList || [];
    
    // Si pas de fichiers dans la réponse stop, essayer l'API query
    if (fileList.length === 0 && !result.alreadyStopped) {
      try {
        console.log('🔍 Récupération des fichiers via API query...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Attendre 3s pour que les fichiers soient prêts
        
        const queryResult = await agoraRecording.queryRecording(
          conference.recordingResourceId,
          conference.recordingSid
        );
        
        fileList = queryResult.serverResponse?.fileList || [];
        console.log(`📁 ${fileList.length} fichier(s) trouvé(s) via query`);
      } catch (queryError) {
        console.log('⚠️ Impossible de récupérer les fichiers via query:', queryError.message);
      }
    }
    
    const fileName = fileList.length > 0 ? fileList[0].fileName : null;
    
    // Construire l'URL complète Supabase Storage (si S3 configuré)
    // Sinon, stocker les infos pour récupération manuelle
    const supabaseUrl = process.env.SUPABASE_URL;
    const bucketName = process.env.SUPABASE_S3_BUCKET || 'recordings';
    let videoUrl = null;
    
    if (fileName && fileName.startsWith('http')) {
      // Si Agora retourne déjà une URL complète (mode S3)
      videoUrl = fileName;
    } else if (fileName) {
      // Mode S3 activé avec nom de fichier
      videoUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
    }
    // Si pas de fileName, videoUrl reste null (mode query sans S3)

    // Mettre à jour la conférence
    await prisma.conference.update({
      where: { id: parseInt(conferenceId) },
      data: {
        isRecording: false,
        videoUrl: videoUrl,
        recordingStoppedAt: new Date()
      }
    });

    // Ajouter la vidéo à la bibliothèque
    if (videoUrl) {
      try {
        await prisma.library.create({
          data: {
            title: `Enregistrement - ${conference.title || 'Conférence'}`,
            type: 'video',
            url: videoUrl,
            description: `Enregistrement de la conférence du ${new Date().toLocaleDateString()}`,
            category: 'Conférences'
          }
        });
        console.log('📚 Vidéo ajoutée à la bibliothèque');
      } catch (libError) {
        console.error('Erreur ajout bibliothèque:', libError);
      }
    }

    res.json({
      success: true,
      message: result.alreadyStopped 
        ? 'Enregistrement déjà arrêté (terminé automatiquement)' 
        : 'Enregistrement arrêté',
      videoUrl: videoUrl,
      fileList: fileList,
      alreadyStopped: result.alreadyStopped || false
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
