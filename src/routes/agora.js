const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

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
