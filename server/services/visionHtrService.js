const sharp = require('sharp');

const DEFAULT_CF_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const FALLBACK_CF_VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const MAX_VISION_IMAGE_DIMENSION = 1600;

function isVisionHtrAvailable(env = process.env) {
  const hasCf = Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim());
  const hasGemini = Boolean(env.GEMINI_API_KEY?.trim() || env.GOOGLE_AI_API_KEY?.trim());
  return hasCf || hasGemini;
}

function cleanVisionTranscript(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^The image shows[\s\S]*?(?:Here is the transcribed (?:content|text)|Here is the transcription|transcription:)\s*[:\n]*/i, '');
  cleaned = cleaned.replace(/\n+\*\*Note:\*\*[\s\S]*$/i, '');
  return cleaned.trim() || rawText.trim();
}

// Ensure the image buffer is compressed and within optimal resolution for Vision models
async function optimizeImageForVision(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    let pipeline = sharp(buffer);
    if ((meta.width && meta.width > MAX_VISION_IMAGE_DIMENSION) || (meta.height && meta.height > MAX_VISION_IMAGE_DIMENSION)) {
      pipeline = pipeline.resize({
        width: MAX_VISION_IMAGE_DIMENSION,
        height: MAX_VISION_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    // High quality JPEG has high visual fidelity with much smaller payload
    return await pipeline.jpeg({ quality: 88 }).toBuffer();
  } catch {
    return buffer;
  }
}

async function transcribeWithCloudflareVision(imageBuffer, mimeType = 'image/jpeg', env = process.env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(env.CLOUDFLARE_API_TOKEN || '').trim();
  const gateway = String(env.CLOUDFLARE_AI_GATEWAY || '').trim();

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Workers AI credentials not configured.');
  }

  const model = String(env.CLOUDFLARE_AI_VISION_MODEL || DEFAULT_CF_VISION_MODEL).trim();
  const optimized = await optimizeImageForVision(imageBuffer);
  const base64 = optimized.toString('base64');

  const promptText = [
    'You are an expert handwriting, whiteboard, and OCR transcription assistant.',
    'Transcribe all handwritten and printed text, mathematical equations, circuit notes, formulas, and annotations from this image clearly and accurately.',
    'For mathematical formulas, format them in clean readable notation or LaTeX (e.g. $M(t) = H(t) * M\'(t)$).',
    'Preserve line breaks and structure where appropriate.',
    'Output only the transcribed content without any conversational greeting or filler.'
  ].join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    // 1. Primary: Cloudflare AI Run endpoint (native byte array support for Llama 3.2 Vision)
    const runUrl = gateway
      ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/${model}`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: promptText,
        image: Array.from(new Uint8Array(optimized))
      }),
      signal: controller.signal
    });

    if (runResponse.ok) {
      const runPayload = await runResponse.json();
      const resultText = runPayload?.result?.response || runPayload?.result?.description || runPayload?.response;
      if (typeof resultText === 'string' && resultText.trim()) {
        return {
          text: resultText.trim(),
          provider: 'cloudflare-workers-ai',
          model
        };
      }
    }

    // 2. Secondary: Chat Completions endpoint
    const baseUrl = gateway
      ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/v1/chat/completions`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }
        ]
      }),
      signal: controller.signal
    });

    if (response.ok) {
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return {
          text: content.trim(),
          provider: 'cloudflare-workers-ai',
          model
        };
      }
    }

    const errBody = await runResponse.text().catch(() => '');
    throw new Error(`Cloudflare Workers AI returned status ${runResponse.status}: ${errBody.slice(0, 200)}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeWithGeminiVision(imageBuffer, mimeType = 'image/jpeg', env = process.env) {
  const apiKey = String(env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Gemini API key not configured.');
  }

  const optimized = await optimizeImageForVision(imageBuffer);
  const base64 = optimized.toString('base64');
  const model = String(env.GEMINI_VISION_MODEL || 'gemini-1.5-flash').trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Transcribe all handwritten and printed text, mathematical equations, notes, formulas, and diagrams in this image accurately. Use clean LaTeX formatting for equations where appropriate. Return only the transcription.'
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2500
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Gemini Vision API status ${response.status}: ${err.slice(0, 200)}`);
    }

    const payload = await response.json();
    const candidate = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidate === 'string' && candidate.trim()) {
      return {
        text: candidate.trim(),
        provider: 'gemini-vision',
        model
      };
    }

    throw new Error('No candidate text returned by Gemini Vision.');
  } finally {
    clearTimeout(timeout);
  }
}

// Master Vision HTR transcriber with automatic provider failover
async function transcribeImageWithVision(imageBuffer, mimeType = 'image/jpeg', env = process.env) {
  const hasCf = Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim());
  const hasGemini = Boolean(env.GEMINI_API_KEY?.trim() || env.GOOGLE_AI_API_KEY?.trim());

  let cfError = null;

  if (hasCf) {
    try {
      const res = await transcribeWithCloudflareVision(imageBuffer, mimeType, env);
      if (res?.text) {
        res.text = cleanVisionTranscript(res.text);
      }
      return res;
    } catch (err) {
      cfError = err;
      console.warn('[Vision HTR] Cloudflare Workers AI attempt failed:', err.message);
    }
  }

  if (hasGemini) {
    try {
      const gRes = await transcribeWithGeminiVision(imageBuffer, mimeType, env);
      if (gRes?.text) {
        gRes.text = cleanVisionTranscript(gRes.text);
      }
      return gRes;
    } catch (geminiErr) {
      console.warn('[Vision HTR] Gemini Vision attempt failed:', geminiErr.message);
      if (cfError) {
        throw new Error(`Vision HTR failed on both providers. Cloudflare: ${cfError.message} | Gemini: ${geminiErr.message}`);
      }
      throw geminiErr;
    }
  }

  if (cfError) throw cfError;
  throw new Error('No Vision AI provider credentials configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN or GEMINI_API_KEY).');
}

module.exports = {
  isVisionHtrAvailable,
  transcribeImageWithVision,
  transcribeWithCloudflareVision,
  transcribeWithGeminiVision,
  optimizeImageForVision
};
