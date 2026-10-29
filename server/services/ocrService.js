const { createWorker } = require('tesseract.js');
const Item = require('../models/Item');

let workerPromise = null;
let queue = Promise.resolve();
let releaseTimer = null;

const IDLE_RELEASE_MS = 5 * 60 * 1000;
const MAX_OCR_CHARS = 20000;

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|co|ai|dev|app|edu|gov|in|me|info|tv)(?:\/[^\s<>"'{}|\\^`[\]]*)?/gi;

function extractUrlsFromText(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  const urls = [];
  for (const match of matches) {
    let clean = match.replace(/[.,;:)\]]+$/, '');
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }
    try {
      const parsed = new URL(clean);
      if (parsed.hostname && parsed.hostname.includes('.') && !urls.includes(clean)) {
        urls.push(clean);
      }
    } catch (e) {}
  }
  return urls;
}

function normalizedText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_OCR_CHARS);
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng').catch((error) => {
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

async function recognize(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
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

module.exports = { enqueueItemOcr, recognize, extractUrlsFromText };
