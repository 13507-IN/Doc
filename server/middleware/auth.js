const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../config/security');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No authentication token provided. Please log in.' });
  }

  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authHeader);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Authentication token is malformed. Please log in again.' });
  }

  try {
    const decoded = jwt.verify(match[1], getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    if (!decoded.sub) {
      return res.status(401).json({ success: false, message: 'Token is invalid or expired. Please log in again.' });
    }

    const user = await User.findById(decoded.sub).select('_id email name');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Token is invalid or expired. Please log in again.' });
    }

    req.user = { id: String(user._id), email: user.email, name: user.name };
    return next();
  } catch (err) {
    if (err.message?.includes('JWT_SECRET must be configured')) {
      return next(err);
    }
    return res.status(401).json({ success: false, message: 'Token is invalid or expired. Please log in again.' });
  }
};
