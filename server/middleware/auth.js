const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'holder_jwt_secret_key_13507';

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];

  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No authentication token provided. Please log in.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id: userId, email: ... }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token is invalid or expired. Please log in again.' });
  }
};
