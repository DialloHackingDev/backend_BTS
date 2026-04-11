const { RtcTokenBuilder, RtcRole } = require('agora-token');

/**
 * Génère un token Agora pour un canal et un UID donnés
 * @param {string} channelName - Nom du canal
 * @param {number} uid - UID de l'utilisateur
 * @param {number} expireTime - Temps d'expiration en secondes (défaut: 3600)
 * @returns {string} Token Agora
 */
function generateAgoraToken(channelName, uid, expireTime = 3600) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error('AGORA_APP_ID et AGORA_APP_CERTIFICATE sont requis pour générer un token');
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpireTime,
    privilegeExpireTime
  );

  return token;
}

module.exports = {
  generateAgoraToken
};
