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
const HIGH_CONFIDENCE_TLDS = '(?:com|org|net|io|ai|dev|app|edu|gov)';

function cleanDomainPart(raw) {
  return raw
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9_-]+$/, '');
}

function extractUrlsFromText(text) {
  if (!text) return [];
  const urls = new Set();
  const lowerText = String(text).toLowerCase();

  // 1. Standard explicit URLs (http://, https://, www., or standard domain.tld)
  const standardRegex = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s<>"'{}|\\\\^\`\\[\\]]+|(?:[a-zA-Z0-9-]+\\.)+${COMMON_TLDS}(?:\\/[^\\s<>"'{}|\\\\^\`\\[\\]]*)?`, 'gi');
  const standardMatches = text.match(standardRegex) || [];
  for (const match of standardMatches) {
    let clean = match.replace(/[.,;:)\]]+$/, '');
    if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
    try {
      const parsed = new URL(clean);
      if (parsed.hostname && parsed.hostname.includes('.') && !urls.has(clean)) {
        urls.add(clean);
      }
    } catch (e) {}
  }

  // 2. Fuzzy Address-Bar Domain Recovery for OCR distortions:
  // Catches: "nextjs org", "nextjs,org", "nextjsorg", "neriisorg", "github com"
  const fuzzyRegex = new RegExp(`(?:^|[\\s|/\\\\>@&])([a-zA-Z0-9_-]{2,30})[\\s,;:.\\-_]?(${HIGH_CONFIDENCE_TLDS})\\b(?:\\/([^\\s<>"'{}|\\\\^\`\\[\\]]*))?`, 'gi');
  let match;
  while ((match = fuzzyRegex.exec(text)) !== null) {
    let domain = cleanDomainPart(match[1]);
    const tld = match[2].toLowerCase();
    const pathPart = match[3] ? `/${match[3]}` : '';

    // Ignore generic English noise words mistakenly matched as domains
    if (['and', 'for', 'the', 'with', 'this', 'from', 'have', 'that', 'your', 'about', 'some', 'more', 'copy', 'item'].includes(domain)) {
      continue;
    }

    // Common OCR letter confusions in small address bar fonts:
    // e.g. "neriis" or "nextis" -> "nextjs" when "next" or "react" is present in page content
    if ((domain.includes('neriis') || domain.includes('nextis') || domain === 'next') && (lowerText.includes('next') || lowerText.includes('react'))) {
      domain = 'nextjs';
    }

    // e.g. "githuh" or "githud" -> "github"
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

function normalizedText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_OCR_CHARS);
}

// Pre-process image with sharp for 10x faster OCR and higher contrast accuracy
async function preprocessImage(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const isSmall = (meta.width && meta.width < 1200) || (meta.height && meta.height < 900);
    const pipeline = sharp(buffer);

    // If the image is smaller or has tiny text, upscale by 1.8x so character x-height exceeds 25px
    if (isSmall && meta.width) {
      pipeline.resize({ width: Math.round(meta.width * 1.8), kernel: 'lanczos3' });
    } else {
      pipeline.resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true });
    }

    return await pipeline
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.2 })
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
