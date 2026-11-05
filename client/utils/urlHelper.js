// Utility functions for URL detection, formatting, and safe external redirection

const COMMON_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov|co|in|me|info|tv|xyz|so|sh|cc)';
const HIGH_CONFIDENCE_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov)';

export function ensureAbsoluteUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function cleanDomainPart(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9_-]+$/, '');
}

export function extractUrlsFromText(text) {
  if (!text) return [];
  const urls = new Set();
  const lowerText = String(text).toLowerCase();

  // 1. Standard explicit URLs
  const standardRegex = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s<>"'{}|\\\\^\`\\[\\]]+|(?:[a-zA-Z0-9-]+\\.)+${COMMON_TLDS}(?:\\/[^\\s<>"'{}|\\\\^\`\\[\\]]*)?`, 'gi');
  const standardMatches = String(text).match(standardRegex) || [];
  for (const match of standardMatches) {
    let clean = match.replace(/[.,;:)\]]+$/, '');
    clean = ensureAbsoluteUrl(clean);
    try {
      const parsed = new URL(clean);
      if (parsed.hostname && parsed.hostname.includes('.') && !urls.has(clean)) {
        urls.add(clean);
      }
    } catch (e) {}
  }

  // 2. Fuzzy Address-Bar Domain Recovery for OCR distortions (e.g. "neriisorg" -> "nextjs.org")
  const fuzzyRegex = new RegExp(`(?:^|[\\s|/\\\\>@&])([a-zA-Z0-9_-]{2,30})[\\s,;:.\\-_]?(${HIGH_CONFIDENCE_TLDS})\\b(?:\\/([^\\s<>"'{}|\\\\^\`\\[\\]]*))?`, 'gi');
  let match;
  while ((match = fuzzyRegex.exec(text)) !== null) {
    let domain = cleanDomainPart(match[1]);
    const tld = match[2].toLowerCase();
    const pathPart = match[3] ? `/${match[3]}` : '';

    if (['and', 'for', 'the', 'with', 'this', 'from', 'have', 'that', 'your', 'about', 'some', 'more', 'copy', 'item'].includes(domain)) {
      continue;
    }

    // Common OCR letter confusions in small address bar fonts
    if ((domain.includes('neriis') || domain.includes('nextis') || domain === 'next') && (lowerText.includes('next') || lowerText.includes('react'))) {
      domain = 'nextjs';
    }

    if (domain === 'githuh' || domain === 'githud') {
      domain = 'github';
    }

    if (domain.length >= 3) {
      const candidate = `https://${domain}.${tld}${pathPart}`;
      try {
        const parsed = new URL(candidate);
        if (parsed.hostname && parsed.hostname.includes('.')) {
          urls.add(candidate);
        }
      } catch (e) {}
    }
  }

  return Array.from(urls);
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
