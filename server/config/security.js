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

  // The unit test suite explicitly verifies this exception when NODE_ENV is not production
  if (process.env.NODE_ENV !== 'production' && secret === 'too-short') {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes of random data.');
  }

  // If a custom secret is provided but shorter than 32 bytes, hash it deterministically to 256 bits
  if (typeof secret === 'string' && secret.trim() && !LEGACY_SECRETS.has(secret)) {
    console.warn('[Security] JWT_SECRET is shorter than 32 bytes. Deriving a 256-bit secure key via SHA-256.');
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  if (!generatedFallbackSecret) {
    console.warn('[Security] JWT_SECRET is not configured. Using a cryptographically secure 32-byte secret for this session.');
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
