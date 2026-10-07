const { v2: cloudinary } = require('cloudinary');

const configured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET)
);

if (!process.env.CLOUDINARY_URL && configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

async function verifyCloudinary() {
  if (!configured) {
    console.error('[Cloudinary] Not configured. Image uploads will use local server storage.');
    return false;
  }

  try {
    await cloudinary.api.ping();
    console.log('[Cloudinary] Connected. Image uploads will use Cloudinary.');
    return true;
  } catch (error) {
    console.error('[Cloudinary] Connection check failed. Image uploads will fall back to local storage:', error.message);
    return false;
  }
}

module.exports = { cloudinary, configured, verifyCloudinary };
