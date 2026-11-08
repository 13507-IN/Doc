const { redactSensitiveText } = require('./cloudflareAiService');
const Folder = require('../models/Folder');

const DEFAULT_TAGGER_MODEL = '@cf/meta/llama-3.2-3b-instruct';

function isGenericTitle(title) {
  if (!title || typeof title !== 'string') return true;
  const trimmed = title.trim();
  if (trimmed.length < 3) return true;

  // Patterns like "Screenshot — 11/8/2026, 4:08 PM", "screenshot.png", "img-1794132-ab3f.png", "document.pdf"
  if (/^Screenshot[\s_\-—:,\d/APMapm.]*(?:\.(?:png|jpg|jpeg|webp|gif))?$/i.test(trimmed)) return true;
  if (/^(?:img|doc|document|quick[-_]clip|file|image|untitled)[\s_\-—:,\da-z.]*$/i.test(trimmed)) return true;
  if (/^(?:https?:\/\/|www\.)[^\s]+$/i.test(trimmed)) return true;

  return false;
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const cleaned = new Set();
  for (const t of tags) {
    if (!t) continue;
    const norm = String(t)
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/[^a-z0-9_-]/g, '')
      .trim();
    if (norm.length >= 2 && norm.length <= 25 && !['screenshot', 'image', 'item', 'file', 'vault'].includes(norm)) {
      cleaned.add(norm);
    }
  }
  return Array.from(cleaned).slice(0, 5);
}

function parseAiJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let clean = raw.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(clean);
  } catch {}

  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// Fast keyword heuristic fallback when AI is unreachable
function extractFallbackTags(text = '', url = '') {
  const tags = new Set();
  const lowerText = text.toLowerCase();

  // Common domain keywords
  if (url) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domainParts = parsed.hostname.replace(/^www\./, '').split('.');
      if (domainParts[0] && domainParts[0].length >= 3) {
        tags.add(domainParts[0]);
      }
    } catch {}
  }

  // Frequent topic buckets
  const TOPIC_MAP = [
    { tag: 'math', regex: /\b(?:formula|equation|derivative|integral|variance|probability|matrix|calculus|algebra)\b/i },
    { tag: 'engineering', regex: /\b(?:circuit|signal|system|stochastic|stationary|frequency|filter|voltage|processor)\b/i },
    { tag: 'coding', regex: /\b(?:javascript|python|react|nextjs|github|api|function|code|component|database|css|html)\b/i },
    { tag: 'finance', regex: /\b(?:invoice|receipt|payment|dollar|usd|inr|tax|price|total|cost|bank|bill)\b/i },
    { tag: 'study', regex: /\b(?:chapter|lecture|notes|homework|exam|syllabus|course|professor|university)\b/i }
  ];

  for (const { tag, regex } of TOPIC_MAP) {
    if (regex.test(lowerText)) {
      tags.add(tag);
    }
  }

  return Array.from(tags).slice(0, 4);
}

async function autoAnalyzeContent({
  text = '',
  url = '',
  currentTitle = '',
  existingFolders = [],
  env = process.env
}) {
  const combinedText = [currentTitle, url, text].filter(Boolean).join('\n\n').slice(0, 3500);
  const safeText = redactSensitiveText(combinedText).trim();

  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(env.CLOUDFLARE_API_TOKEN || '').trim();
  const hasCf = Boolean(/^[a-f0-9]{32}$/i.test(accountId) && apiToken);

  if (hasCf && safeText.length >= 10) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: DEFAULT_TAGGER_MODEL,
          max_tokens: 300,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: [
                'You are an intelligent auto-tagging and categorization engine for a personal vault.',
                'Analyze the content (which could be OCR text, notes, or web metadata) and the user\'s existing folders.',
                'Return a valid JSON object ONLY with:',
                '1. "title": A concise, descriptive, human-friendly title (max 50 chars). Do NOT use generic words like "Screenshot", "Note", or "Untitled".',
                '2. "tags": An array of 3 to 5 single-word lowercase tags without "#" symbols.',
                '3. "folder": The exact name of the best-matching folder from the provided list, or "" if none are a clear match.',
                '4. "summary": A 1-sentence concise summary of the content.',
                'Respond with valid JSON only. No preamble, no markdown backticks.'
              ].join(' ')
            },
            {
              role: 'user',
              content: JSON.stringify({
                existingFolders: Array.isArray(existingFolders) ? existingFolders.slice(0, 20) : [],
                content: safeText
              })
            }
          ]
        }),
        signal: controller.signal
      });

      if (response.ok) {
        const payload = await response.json();
        const rawContent = payload?.choices?.[0]?.message?.content;
        const parsed = parseAiJson(rawContent);

        if (parsed && typeof parsed === 'object') {
          const suggestedTitle = typeof parsed.title === 'string' ? parsed.title.trim() : '';
          const suggestedTags = cleanTags(parsed.tags);
          const suggestedFolder = typeof parsed.folder === 'string' ? parsed.folder.trim() : '';
          const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

          return {
            title: suggestedTitle,
            tags: suggestedTags.length > 0 ? suggestedTags : extractFallbackTags(safeText, url),
            folder: suggestedFolder,
            summary,
            source: 'cloudflare-ai'
          };
        }
      }
    } catch (err) {
      console.warn('[AutoTagger] Cloudflare Workers AI call failed, falling back:', err.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fallback heuristic
  const fallbackTags = extractFallbackTags(safeText, url);
  return {
    title: '',
    tags: fallbackTags,
    folder: '',
    summary: '',
    source: 'heuristic'
  };
}

// Background auto-enrichment for an item document
async function enrichItemWithAi(item, options = {}) {
  try {
    if (!item || !item.userId) return null;

    const needsTitle = isGenericTitle(item.title);
    const needsTags = !item.tags || item.tags.length <= 1 || (item.tags.length === 1 && item.tags[0] === 'screenshot');
    const needsFolder = !item.folderId;

    if (!needsTitle && !needsTags && !needsFolder && !options.force) {
      return item;
    }

    const textToAnalyze = [
      item.ocrText,
      item.content,
      item.metadata?.description,
      item.metadata?.pageTitle,
      item.url
    ].filter(Boolean).join('\n\n');

    if (!textToAnalyze || textToAnalyze.trim().length < 10) {
      return item;
    }

    // Retrieve user's existing folders for smart auto-filing
    const userFolders = await Folder.find({ userId: item.userId }).select('_id name');
    const folderNames = userFolders.map((f) => f.name);

    const result = await autoAnalyzeContent({
      text: textToAnalyze,
      url: item.url || '',
      currentTitle: item.title || '',
      existingFolders: folderNames
    });

    let updated = false;

    // Apply smart title if current title is generic
    if (result.title && (needsTitle || options.force)) {
      item.title = result.title;
      updated = true;
    }

    // Apply smart tags
    if (result.tags && result.tags.length > 0) {
      const mergedTags = [...new Set([...(item.tags || []), ...result.tags])];
      item.tags = mergedTags;
      updated = true;
    }

    // Auto-file into matching folder if currently uncategorized
    if (result.folder && (needsFolder || options.force)) {
      const matched = userFolders.find(
        (f) => f.name.toLowerCase() === result.folder.toLowerCase()
      );
      if (matched) {
        item.folderId = matched._id;
        updated = true;
      }
    }

    if (result.summary) {
      if (!item.metadata) item.metadata = {};
      item.metadata.aiSummary = result.summary;
      item.markModified('metadata');
      updated = true;
    }

    if (updated) {
      await item.save();
      console.log(`[AutoTagger] Enriched item ${item._id}: "${item.title}" | Tags: [${(item.tags || []).join(', ')}] | Folder: ${result.folder || 'unchanged'}`);
    }

    return item;
  } catch (err) {
    console.warn('[AutoTagger] Enrichment failed:', err.message);
    return item;
  }
}

module.exports = {
  isGenericTitle,
  cleanTags,
  autoAnalyzeContent,
  enrichItemWithAi
};
