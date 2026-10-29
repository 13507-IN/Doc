// Utility functions for URL detection, formatting, and safe external redirection

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|co|ai|dev|app|edu|gov|in|me|info|tv)(?:\/[^\s<>"'{}|\\^`[\]]*)?/gi;

export function ensureAbsoluteUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function extractUrlsFromText(text) {
  if (!text) return [];
  const matches = String(text).match(URL_REGEX) || [];
  const urls = [];
  for (const match of matches) {
    let clean = match.replace(/[.,;:)\]]+$/, '');
    clean = ensureAbsoluteUrl(clean);
    try {
      const parsed = new URL(clean);
      if (parsed.hostname && parsed.hostname.includes('.') && !urls.includes(clean)) {
        urls.push(clean);
      }
    } catch (e) {}
  }
  return urls;
}

export function isImageFileUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  return (
    lower.includes('cloudinary') ||
    lower.includes('/uploads/') ||
    /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(lower)
  );
}

// Extracts the actual website URL associated with an item (especially for screenshots/images)
export function getWebsiteUrlForItem(item) {
  if (!item) return null;

  // 1. Check metadata.detectedUrls first
  if (item.metadata?.detectedUrls && Array.isArray(item.metadata.detectedUrls) && item.metadata.detectedUrls.length > 0) {
    return ensureAbsoluteUrl(item.metadata.detectedUrls[0]);
  }

  // 2. If item.url is already a valid website (and not a raw image asset URL)
  if (item.url && !isImageFileUrl(item.url)) {
    return ensureAbsoluteUrl(item.url);
  }

  // 3. Fallback: extract from OCR text if available
  if (item.ocrText) {
    const extracted = extractUrlsFromText(item.ocrText);
    if (extracted.length > 0) {
      return extracted[0];
    }
  }

  return null;
}
