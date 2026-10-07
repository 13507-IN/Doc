const { createWorker } = require('tesseract.js');
const Item = require('../models/Item');

let workerPromise = null;
let queue = Promise.resolve();
let releaseTimer = null;

const IDLE_RELEASE_MS = 5 * 60 * 1000;
const MAX_OCR_CHARS = 20000;

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
        await Item.findByIdAndUpdate(itemId, { ocrText, ocrStatus: 'done', ocrError: '' });
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

module.exports = { enqueueItemOcr, recognize };
