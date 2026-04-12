const axios = require('axios');

/**
 * Service d'enregistrement Agora Cloud Recording
 * Gère le démarrage et l'arrêt des enregistrements
 */
class AgoraRecordingService {
  constructor() {
    this.appId = process.env.AGORA_APP_ID;
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE;
    this.customerId = process.env.AGORA_CUSTOMER_ID;
    this.customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    this.baseUrl = 'https://api.agora.io/v1/apps';
    // Mode simulation pour tester sans l'API Agora (désactivé par défaut)
    this.simulationMode = process.env.AGORA_SIMULATION_MODE === 'true';
  }

  /**
   * Configuration de l'enregistrement
   */
  getRecordingConfig() {
    return {
      maxIdleTime: 30,
      streamTypes: 2,
      channelType: 0,
      videoStreamType: 0,
      transcodingConfig: {
        height: 640,
        width: 360,
        bitrate: 500,
        fps: 15,
        mixedVideoLayout: 1,
        backgroundColor: "#000000"
      }
      // Pas de subscribeVideoUids/subscribeAudioUids = souscrire à tous automatiquement
    };
  }

  /**
   * Configuration du fichier de sortie vers S3
   * 
   * NOTE: Supabase Storage S3-compatible ne fonctionne pas directement avec Agora Cloud Recording.
   * Pour que l'enregistrement fonctionne, utilisez un vrai bucket AWS S3 ou laissez null
   * pour utiliser le mode "query" d'Agora (récupération manuelle via API).
   */
  getStorageConfig() {
    // Désactivé temporairement - Supabase S3 n'est pas compatible avec Agora
    // Pour activer, configurez un vrai bucket AWS S3 avec les variables:
    // AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    
    const bucket = process.env.AWS_S3_BUCKET || process.env.SUPABASE_S3_BUCKET;
    const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.SUPABASE_S3_ACCESS_KEY;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.SUPABASE_S3_SECRET_KEY;
    
    // Si AWS S3 n'est pas configuré, retourner null pour le mode query
    if (!accessKey || !secretKey || !bucket) {
      console.log('📦 Mode query activé (sans stockage S3). Les vidéos seront récupérables via API query.');
      return null;
    }
    
    console.log(`📦 Stockage S3 configuré: ${bucket}`);
    
    return {
      vendor: 1, // 1 = AWS S3
      region: 0, // 0 = US East (N. Virginia)
      bucket: bucket,
      accessKey: accessKey,
      secretKey: secretKey,
      fileNamePrefix: ["recordings", new Date().toISOString().split('T')[0]]
    };
  }

  /**
   * Active le mode simulation pour les tests
   */
  enableSimulationMode() {
    this.simulationMode = true;
    console.log('🎬 Mode simulation activé pour les enregistrements');
  }

  /**
   * Génère les credentials pour l'API Agora
   */
  getCredentials() {
    const credentials = Buffer.from(`${this.customerId}:${this.customerSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Démarre l'enregistrement d'une conférence
   * @param {string} channelName - Nom du canal Agora
   * @param {number} uid - UID de l'enregistreur (doit être unique, ex: 999999)
   * @returns {Promise<{resourceId: string, sid: string}>}
   */
  async startRecording(channelName, uid = 999999) {
    // Mode simulation pour tester sans l'API Agora
    if (this.simulationMode) {
      console.log(`🎬 [SIMULATION] Démarrage enregistrement - Channel: ${channelName}`);
      return {
        resourceId: `sim-resource-${Date.now()}`,
        sid: `sim-sid-${Date.now()}`,
        uid: uid,
        simulated: true
      };
    }

    try {
      // Vérifier la configuration
      if (!this.isConfigured()) {
        throw new Error('Configuration Agora incomplete. Verifier AGORA_APP_ID, AGORA_APP_CERTIFICATE, AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET');
      }

      console.log(`Démarrage enregistrement - Channel: ${channelName}, UID: ${uid}`);
      console.log(`AppID: ${this.appId?.substring(0, 10)}... CustomerID: ${this.customerId?.substring(0, 10)}...`);

      // Étape 1: Acquérir un resourceId
      const resourceRes = await axios.post(
        `${this.baseUrl}/${this.appId}/cloud_recording/acquire`,
        {
          cname: channelName,
          uid: uid.toString(),
          clientRequest: {
            resourceExpiredHour: 24,
            scene: 0
          }
        },
        {
          headers: {
            'Authorization': this.getCredentials(),
            'Content-Type': 'application/json'
          }
        }
      );

      const resourceId = resourceRes.data.resourceId;

      // Étape 2: Générer un token pour l'enregistreur
      const { generateAgoraToken } = require('../utils/agoraToken');
      const recorderToken = generateAgoraToken(channelName, uid);
      console.log(`Token enregistreur généré: ${recorderToken.substring(0, 20)}...`);

      // Étape 3: Démarrer l'enregistrement
      const storageConfig = this.getStorageConfig();
      console.log(`📦 Configuration S3: ${storageConfig ? 'Activée' : 'Désactivée'}`);
      
      const clientRequest = {
        token: recorderToken, // Token valide pour l'enregistreur
        recordingConfig: {
          channelType: 0, // 0 = Communication, 1 = Live
          streamTypes: 2, // 0 = Audio only, 1 = Video only, 2 = Audio + Video
          maxIdleTime: 30 // Arrêter après 30s d'inactivité
          // Pas de subscribeVideoUids/subscribeAudioUids = souscrire à tous automatiquement
        }
      };
      
      // Ajouter la configuration de stockage seulement si configuré
      if (storageConfig) {
        clientRequest.recordingFileConfig = {
          avFileType: ['hls', 'mp4'] // Formats de sortie
        };
        clientRequest.storageConfig = storageConfig;
      }
      
      const recordingConfig = {
        cname: channelName,
        uid: uid.toString(),
        clientRequest
      };

      const startRes = await axios.post(
        `${this.baseUrl}/${this.appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
        recordingConfig,
        {
          headers: {
            'Authorization': this.getCredentials(),
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        resourceId: resourceId,
        sid: startRes.data.sid,
        uid: uid
      };
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      const status = error.response?.status;

      console.error('=== ERREUR AGORA CLOUD RECORDING ===');
      console.error('Status:', status);
      console.error('Data:', JSON.stringify(errorDetails, null, 2));
      console.error('Message:', error.message);
      console.error('=====================================');

      // Fallback automatique en mode simulation si erreur 400/401 (permissions/quota)
      if ((status === 400 || status === 401) && process.env.AGORA_AUTO_SIMULATION === 'true') {
        console.log('🔄 Fallback automatique en mode simulation');
        return {
          resourceId: `fallback-sim-${Date.now()}`,
          sid: `fallback-sid-${Date.now()}`,
          uid: uid,
          simulated: true,
          fallbackReason: errorDetails?.message || 'API Agora non disponible'
        };
      }

      // Créer une erreur enrichie avec les détails
      const enrichedError = new Error(errorDetails?.message || error.message);
      enrichedError.status = status;
      enrichedError.agoraData = errorDetails;
      throw enrichedError;
    }
  }

  /**
   * Arrête l'enregistrement
   * @param {string} channelName - Nom du canal
   * @param {string} resourceId - Resource ID
   * @param {string} sid - Session ID
   * @param {number} uid - UID de l'enregistreur
   * @returns {Promise<{serverResponse: object, fileList: array}>}
   */
  async stopRecording(channelName, resourceId, sid, uid = 999999) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
        {
          cname: channelName,
          uid: uid.toString(),
          clientRequest: {}
        },
        {
          headers: {
            'Authorization': this.getCredentials(),
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.reason || error.message;
      const statusCode = error.response?.status;
      
      // Erreur 404 "failed to find worker" = le worker s'est déjà arrêté automatiquement
      if (statusCode === 404 && errorMessage?.includes('failed to find worker')) {
        console.log('⚠️ Worker déjà arrêté (enregistrement terminé automatiquement)');
        return {
          serverResponse: {
            fileList: [],
            status: 'already stopped'
          },
          alreadyStopped: true
        };
      }
      
      console.error('Erreur arrêt enregistrement Agora:', errorData || error.message);
      throw error;
    }
  }

  /**
   * Récupère le statut d'un enregistrement
   */
  async queryRecording(resourceId, sid) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/query`,
        {
          headers: {
            'Authorization': this.getCredentials(),
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Erreur query recording:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Vérifie si la configuration est complète
   */
  isConfigured() {
    return !!(this.appId && this.appCertificate && this.customerId && this.customerSecret);
  }
}

module.exports = new AgoraRecordingService();
