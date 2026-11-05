function isInternalMediaUrl(value) {
  if (typeof value !== 'string' || !value) return false;

  try {
    const url = new URL(value, 'http://holder.local');
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    return (
      /\/api\/(?:items|uploads)\/[^/]+\/media(?:\/|$)/.test(pathname) ||
      pathname.split('/').includes('uploads') ||
      ((hostname === 'cloudinary.com' || hostname.endsWith('.cloudinary.com')) &&
        /\/(image|raw|video)\/(upload|private|authenticated)\//.test(pathname))
    );
  } catch {
    return false;
  }
}

const INTERNAL_MEDIA_KEYS = new Set([
  'cloudinaryPublicId',
  'cloudinaryType',
  'cloudinaryResourceType',
  'cloudinaryFormat',
  'localFilename',
  'mediaStorage',
  'mediaMimeType',
  'uploadId',
  'imageUrl',
  'pdfUrl',
  'cloudinaryUrl',
  'secureUrl'
]);

function sanitizeMetadata(value) {
  if (typeof value === 'string') {
    return isInternalMediaUrl(value) ? '' : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata).filter((entry) => entry !== '');
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !INTERNAL_MEDIA_KEYS.has(key))
      .map(([key, entry]) => [key, sanitizeMetadata(entry)])
  );
}

function serializeItem(item) {
  if (!item) return item;

  const plain = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  const sourceMetadata = plain.metadata && typeof plain.metadata === 'object'
    ? plain.metadata
    : {};
  const hasStoredMedia = Boolean(
    sourceMetadata.cloudinaryPublicId ||
    sourceMetadata.localFilename
  );
  const metadata = sanitizeMetadata(sourceMetadata);

  if (hasStoredMedia && plain._id) {
    plain.mediaUrl = `/api/items/${plain._id}/media`;
  }
  if (isInternalMediaUrl(plain.previewUrl)) plain.previewUrl = '';
  if (isInternalMediaUrl(plain.url)) plain.url = '';

  plain.metadata = metadata;
  return plain;
}

module.exports = { serializeItem, isInternalMediaUrl };
