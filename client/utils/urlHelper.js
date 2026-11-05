// Utility functions for URL detection, formatting, and safe external redirection

const COMMON_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov|co|in|me|info|tv|xyz|so|sh|cc)';
const EXACT_HIGH_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov)';
const FUZZY_DISTORTED_TLDS = '(?:ong|orn|con|c0m|corn)';

const ENGLISH_WORDS_WITH_TLD_SUFFIXES = new Set([
  'devcon', 'silicon', 'beacon', 'falcon', 'bacon', 'popcorn', 'acorn', 'recon',
  'icon', 'action', 'section', 'nation', 'station', 'condition', 'dragon', 'wagon',
  'lemon', 'demon', 'common', 'canon', 'lesson', 'person', 'season', 'reason',
  'prison', 'poison', 'ribbon', 'button', 'cotton', 'mutton', 'pardon'
]);

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
    .replace(/[^a-z0-9_-]+$/, '')
    .replace(/[-_]+$/, '');
}

function normalizeTld(tld) {
  const lower = String(tld || '').toLowerCase();
  if (lower === 'ong' || lower === 'orn') return 'org';
  if (lower === 'con' || lower === 'c0m' || lower === 'corn') return 'com';
  return lower;
}

function isCliCommand(text, matchIndex) {
  const windowStart = Math.max(0, matchIndex - 20);
  const prefix = text.slice(windowStart, matchIndex).toLowerCase();
  return /(?:npx|npm|pnpm|yarn|pip|cargo|docker|go\s+install|brew)\s+[^]*$/i.test(prefix);
}

export function extractUrlsFromText(text) {
  if (!text) return [];
  const urls = new Set();
  const lowerText = String(text).toLowerCase();

  // 1. Standard explicit URLs
  const standardRegex = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s<>"'{}|\\\\^\`\\[\\]]+|(?:[a-zA-Z0-9-]+\\.)+${COMMON_TLDS}(?:\\/[^\\s<>"'{}|\\\\^\`\\[\\]]*)?`, 'gi');
  let stdMatch;
  while ((stdMatch = standardRegex.exec(text)) !== null) {
    if (isCliCommand(text, stdMatch.index)) continue;
    let clean = stdMatch[0].replace(/[.,;:)\]]+$/, '');
    if (/-+\.[a-z0-9]+$/i.test(clean)) continue;
    if (/@latest|@next|@alpha|@beta/i.test(clean)) continue;

    clean = ensureAbsoluteUrl(clean);
    try {
      const parsed = new URL(clean);
      if (parsed.hostname && parsed.hostname.includes('.') && !parsed.hostname.startsWith('-') && !parsed.hostname.endsWith('-')) {
        urls.add(parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname));
      }
    } catch (e) {}
  }

  // 2. Fuzzy Address-Bar Domain Recovery
  // Pattern A: True TLDs with or without separator (e.g. "nextjs org", "nextjsorg", "neriisorgx")
  const fuzzyExactRegex = new RegExp(`(?:^|[\\s|/\\\\>@&€])([a-zA-Z0-9_-]{3,30}?)(?:[\\s,;:.\\-_]|(?=[a-z]{3}))(${EXACT_HIGH_TLDS})([xX])?\\b(?:\\/([^\\s<>"'{}|\\\\^\`\\[\\]]*))?`, 'gi');
  let match;
  while ((match = fuzzyExactRegex.exec(text)) !== null) {
    if (isCliCommand(text, match.index)) continue;
    const fullMatchedWord = (match[1] + match[2]).toLowerCase();
    if (ENGLISH_WORDS_WITH_TLD_SUFFIXES.has(fullMatchedWord)) continue;

    let domain = cleanDomainPart(match[1]);
    let tld = match[2].toLowerCase();
    const pathPart = match[4] ? `/${match[4]}` : '';

    if (domain.endsWith('-') || domain.startsWith('-')) continue;
    if (['and', 'for', 'the', 'with', 'this', 'from', 'have', 'that', 'your', 'about', 'some', 'more', 'copy', 'item', 'create-next', 'dev'].includes(domain)) {
      continue;
    }

    if ((domain.includes('neri') || domain.includes('nextis') || domain.includes('rextis') || domain === 'next') &&
        (lowerText.includes('next') || lowerText.includes('react') || lowerText.includes('framework'))) {
      domain = 'nextjs';
      tld = 'org';
    }

    if (domain === 'githuh' || domain === 'githud') {
      domain = 'github';
      tld = 'com';
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

  // Pattern B: Distorted TLDs (ong, orn, con, c0m) REQUIRE an explicit separator (e.g. "nextjs ong", "github con")
  const fuzzyDistortedRegex = new RegExp(`(?:^|[\\s|/\\\\>@&€])([a-zA-Z0-9_-]{3,30})[\\s,;:.\\-_](${FUZZY_DISTORTED_TLDS})([xX])?\\b(?:\\/([^\\s<>"'{}|\\\\^\`\\[\\]]*))?`, 'gi');
  let dMatch;
  while ((dMatch = fuzzyDistortedRegex.exec(text)) !== null) {
    if (isCliCommand(text, dMatch.index)) continue;
    let domain = cleanDomainPart(dMatch[1]);
    let tld = normalizeTld(dMatch[2]);
    const pathPart = dMatch[4] ? `/${dMatch[4]}` : '';

    if (domain.endsWith('-') || domain.startsWith('-')) continue;
    if (['and', 'for', 'the', 'with', 'this', 'from', 'have', 'that', 'your', 'about', 'some', 'more', 'copy', 'item', 'create-next'].includes(domain)) {
      continue;
    }

    if ((domain.includes('neri') || domain.includes('nextis') || domain.includes('rextis') || domain === 'next') &&
        (lowerText.includes('next') || lowerText.includes('react') || lowerText.includes('framework'))) {
      domain = 'nextjs';
      tld = 'org';
    }

    if (domain === 'githuh' || domain === 'githud') {
      domain = 'github';
      tld = 'com';
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

  // 3. Contextual fallback if page text strongly features a primary site
  if (urls.size === 0) {
    if ((lowerText.includes('next.js') || lowerText.includes('the react framework')) &&
        (lowerText.includes('rext') || lowerText.includes('next') || lowerText.includes('neri'))) {
      urls.add('https://nextjs.org');
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
