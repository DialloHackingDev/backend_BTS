const https = require('https');
const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'bts-library';

/**
 * Upload un fichier vers Supabase Storage
 * @param {Buffer} fileBuffer - contenu du fichier
 * @param {string} originalName - nom original
 * @param {string} mimeType - type MIME
 * @param {string} folder - dossier (library, avatars)
 * @returns {Promise<string>} URL publique permanente
 */
async function uploadToStorage(fileBuffer, originalName, mimeType, folder = 'library') {
  const safeName = originalName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = `${folder}/${Date.now()}-${safeName}`;

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;

  await _request('POST', url, fileBuffer, {
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'apikey': SUPABASE_SERVICE_KEY,
    'Content-Type': mimeType,
    'Content-Length': fileBuffer.length,
    'x-upsert': 'true',
  });

  // URL publique permanente
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
  return publicUrl;
}

/**
 * Supprime un fichier depuis son URL Supabase
 */
async function deleteFromStorage(fileUrl) {
  if (!fileUrl || !fileUrl.includes(SUPABASE_URL)) return;
  try {
    const filePath = fileUrl.split(`/object/public/${BUCKET}/`)[1];
    if (!filePath) return;

    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;
    await _request('DELETE', url, null, {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    });
  } catch (e) {
    console.warn('Impossible de supprimer le fichier Supabase:', e.message);
  }
}

// Helper HTTP request
function _request(method, urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Supabase Storage error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { uploadToStorage, deleteFromStorage };
