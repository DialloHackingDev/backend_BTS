const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_me';

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedPayload = jwt.verify(token, JWT_SECRET);
    req.user = decodedPayload;
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    res.status(403).json({ error: 'Unauthorized or expired token' });
  }
};

module.exports = verifyToken;
