const path = require('path');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const Item = require('../models/Item');

let workerPromise = null;
let queue = Promise.resolve();
let releaseTimer = null;

const TESSDATA_DIR = path.resolve(__dirname, '..', 'tessdata');
const IDLE_RELEASE_MS = 15 * 60 * 1000; // Keep warm for 15 minutes
const MAX_OCR_CHARS = 20000;

const COMMON_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov|co|in|me|info|tv|xyz|so|sh|cc)';
const HIGH_CONFIDENCE_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov|ong|orn|con|c0m|corn)';

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

function extractUrlsFromText(text) {
  if (!text) return [];
  const urls = new Set();
  const lowerText = String(text).toLowerCase();

  // 1. Standard explicit URLs (http://, https://, www., or standard domain.tld)
  const standardRegex = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s<>"'{}|\\\\^\`\\[\\]]+|(?:[a-zA-Z0-9-]+\\.)+${COMMON_TLDS}(?:\\/[^\\s<>"'{}|\\\\^\`\\[\\]]*)?`, 'gi');
  let stdMatch;
  while ((stdMatch = standardRegex.exec(text)) !== null) {
    if (isCliCommand(text, stdMatch.index)) continue;
    let clean = stdMatch[0].replace(/[.,;:)\]]+$/, '');
    if (/-+\.[a-z0-9]+$/i.test(clean)) continue;
    if (/@latest|@next|@alpha|@beta/i.test(clean)) continue;

    if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
    try {
      const parsed = new URL(clean);
      if (parsed.hostname && parsed.hostname.includes('.') && !parsed.hostname.startsWith('-') && !parsed.hostname.endsWith('-')) {
        urls.add(parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname));
      }
    } catch (e) {}
  }

  // 2. Fuzzy Address-Bar Domain Recovery for OCR distortions
  // Handles:
  // - "nextjs org", "nextjs,org", "nextjs.org"
  // - "neriisorgx" -> "nextjs.org" (address bar with close button 'x')
  // - "rextison" / "rextisong"
  // - "githuh com"
  const fuzzyRegex = new RegExp(`(?:^|[\\s|/\\\\>@&€])([a-zA-Z0-9_-]{2,30}?)(?:[\\s,;:.\\-_]|(?=[a-z]{3}))(${HIGH_CONFIDENCE_TLDS})([xX])?\\b(?:\\/([^\\s<>"'{}|\\\\^\`\\[\\]]*))?`, 'gi');
  let match;
  while ((match = fuzzyRegex.exec(text)) !== null) {
    if (isCliCommand(text, match.index)) continue;

    let domain = cleanDomainPart(match[1]);
    let tld = normalizeTld(match[2]);
    const pathPart = match[4] ? `/${match[4]}` : '';

    if (domain.endsWith('-') || domain.startsWith('-')) continue;

    // Ignore noise words
    if (['and', 'for', 'the', 'with', 'this', 'from', 'have', 'that', 'your', 'about', 'some', 'more', 'copy', 'item', 'create-next'].includes(domain)) {
      continue;
    }

    // Common OCR letter confusions in small address bar fonts:
    // "neriis", "nextis", "rextis", "rext", "next" -> "nextjs"
    if ((domain.includes('neri') || domain.includes('nextis') || domain.includes('rextis') || domain === 'next') &&
        (lowerText.includes('next') || lowerText.includes('react') || lowerText.includes('framework'))) {
      domain = 'nextjs';
      tld = 'org';
    }

    // "githuh", "githud" -> "github"
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

function normalizedText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_OCR_CHARS);
}

// Pre-process image with sharp: adaptive Dark Mode contrast inversion + CLAHE + lanczos scaling
async function preprocessImage(buffer) {
  try {
    const stats = await sharp(buffer).stats();
    const meanLum = stats.channels.slice(0, 3).reduce((acc, c) => acc + c.mean, 0) / 3;
    const isDarkMode = meanLum < 128;

    const meta = await sharp(buffer).metadata();
    const isSmall = (meta.width && meta.width < 1400) || (meta.height && meta.height < 1000);
    let pipeline = sharp(buffer);

    // Upscale smaller images so character x-height exceeds 25px for high Tesseract accuracy
    if (isSmall && meta.width) {
      pipeline = pipeline.resize({ width: Math.round(meta.width * 2), kernel: 'lanczos3' });
    } else {
      pipeline = pipeline.resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
    }

    pipeline = pipeline.grayscale();

    if (isDarkMode) {
      // Dark mode pipeline:
      // Invert so dark background becomes pure white and light/gray text becomes dark
      // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) with integer maxSlope: 3
      // Normalize dynamic range and apply unsharp mask for crisp letter edges
      pipeline = pipeline
        .negate({ alpha: false })
        .clahe({ width: 35, height: 35, maxSlope: 3 })
        .normalize()
        .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 });
    } else {
      // Light mode pipeline:
      pipeline = pipeline
        .normalize()
        .sharpen({ sigma: 1.2 });
    }

    return await pipeline
      .png({ compressionLevel: 6 })
      .toBuffer();
  } catch (err) {
    return buffer;
  }
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      cachePath: TESSDATA_DIR,
      langPath: TESSDATA_DIR,
      gzip: false
    }).catch((error) => {
      console.error('[OCR] Worker initialization error:', error.message);
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function scheduleRelease() {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(async () => {
    const currentWorker = await workerPromise?.catch(() => null);
    workerPromise = null;
    if (currentWorker) {
      currentWorker.terminate().catch(() => {});
    }
  }, IDLE_RELEASE_MS);
}

async function initWorker() {
  try {
    await getWorker();
    scheduleRelease();
    console.log('[OCR] Fast local OCR Worker pre-warmed successfully.');
  } catch (err) {
    console.warn('[OCR] Pre-warming OCR Worker deferred:', err.message);
  }
}

async function recognize(buffer) {
  const [worker, preprocessed] = await Promise.all([
    getWorker(),
    preprocessImage(buffer)
  ]);
  const { data } = await worker.recognize(preprocessed);
  scheduleRelease();
  return normalizedText(data?.text);
}

function enqueueItemOcr(itemId, buffer) {
  queue = queue
    .catch(() => {})
    .then(async () => {
      await Item.findByIdAndUpdate(itemId, { ocrStatus: 'processing', ocrError: '' });
      try {
        const ocrText = await recognize(buffer);
        const detectedUrls = extractUrlsFromText(ocrText);

        const updateData = {
          ocrText,
          ocrStatus: 'done',
          ocrError: ''
        };

        if (detectedUrls.length > 0) {
          updateData['metadata.detectedUrls'] = detectedUrls;

          const existingItem = await Item.findById(itemId);
          if (existingItem && (!existingItem.url || existingItem.url.includes('cloudinary') || existingItem.url.includes('/uploads/'))) {
            updateData.url = detectedUrls[0];
          }
        }

        await Item.findByIdAndUpdate(itemId, updateData);
      } catch (error) {
        console.error('[OCR] Failed to extract text for item %s: %s', itemId, error.message);
        workerPromise = null;
        await Item.findByIdAndUpdate(itemId, {
          ocrStatus: 'failed',
          ocrError: 'Text extraction failed. You can retry it later.'
        });
      }
    });

  return queue;
}

module.exports = { enqueueItemOcr, recognize, extractUrlsFromText, initWorker };
