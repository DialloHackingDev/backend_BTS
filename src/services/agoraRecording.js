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

      // Étape 2: Démarrer l'enregistrement
      const recordingConfig = {
        cname: channelName,
        uid: uid.toString(),
        clientRequest: {
          token: null, // Mode APP ID sans token pour l'enregistreur
          recordingConfig: {
            channelType: 0, // 0 = Communication, 1 = Live
            streamTypes: 2, // 0 = Audio only, 1 = Video only, 2 = Audio + Video
            maxIdleTime: 30, // Arrêter après 30s d'inactivité
            subscribeVideoUids: ['#allhosts'], // Enregistrer tous les participants
            subscribeAudioUids: ['#allhosts'],
            subscribeUidGroup: 0
          },
          recordingFileConfig: {
            avFileType: ['hls', 'mp4'] // Formats de sortie
          },
          storageConfig: this.getStorageConfig()
        }
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
      console.error('Erreur démarrage enregistrement Agora:', error.response?.data || error.message);
      throw error;
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
      console.error('Erreur arrêt enregistrement Agora:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupère le statut d'un enregistrement
   */
  async queryRecording(resourceId, sid) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`,
        {
          headers: {
            'Authorization': this.getCredentials()
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur query enregistrement:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Configuration du stockage Agora (Qiniu - stockage par défaut d'Agora)
   * N'utilise PAS S3/Supabase pour éviter les erreurs de configuration
   */
  getStorageConfig() {
    // Utiliser uniquement le stockage Agora (Qiniu) - plus simple et intégré
    return {
      vendor: 0, // 0 = Qiniu (stockage Agora par défaut)
      region: 0,  // 0 = Chine, 1 = US, 2 = Europe, etc.
      bucket: null,
      accessKey: null,
      secretKey: null,
      fileNamePrefix: ['bts', 'recordings', new Date().toISOString().split('T')[0]]
    };
  }

  /**
   * Vérifie si la configuration est complète
   */
  isConfigured() {
    return !!(this.appId && this.appCertificate && this.customerId && this.customerSecret);
  }
}

module.exports = new AgoraRecordingService();
