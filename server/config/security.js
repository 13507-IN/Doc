const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_ISSUER = 'holder-api';
const JWT_AUDIENCE = 'holder-client';
// There is no refresh-token flow yet, so this balances session usability with
// a smaller exposure window for bearer tokens stored in browser localStorage.
const ACCESS_TOKEN_LIFETIME = '12h';
const LEGACY_SECRETS = new Set([
  'holder_jwt_secret_key_13507',
  'holder_session_secret_13507'
]);

let generatedFallbackSecret = null;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (
    typeof secret === 'string' &&
    Buffer.byteLength(secret, 'utf8') >= 32 &&
    !LEGACY_SECRETS.has(secret)
  ) {
    return secret;
  }

  if (secret !== undefined && secret !== null && typeof secret === 'string' && !LEGACY_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes of random data.');
  }

  if (!generatedFallbackSecret) {
    console.warn('[Security] JWT_SECRET is not configured. Using a cryptographically secure 32-byte secret for this session. Configure JWT_SECRET in production environment variables.');
    generatedFallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  return generatedFallbackSecret;
}

function getSessionSecret() {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update('holder:express-session:v1')
    .digest('hex');
}

function createAccessToken(user) {
  return jwt.sign(
    {},
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_LIFETIME,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: String(user._id)
    }
  );
}

module.exports = {
  ACCESS_TOKEN_LIFETIME,
  JWT_ISSUER,
  JWT_AUDIENCE,
  createAccessToken,
  getJwtSecret,
  getSessionSecret
};
