const Item = require('../models/Item');
const Folder = require('../models/Folder');
const { extractUrlsFromText } = require('../services/ocrService');
const { serializeItem } = require('../services/itemSerializer');
const {
  generateVaultAnswer,
  isPrivateVaultItem,
  isSensitiveQuery
} = require('../services/cloudflareAiService');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// In-memory query cache for instant (0ms) repeated assistant queries
const queryCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL
const MAX_CACHE_ENTRIES = 200;

function getCachedQuery(userId, query) {
  const key = `${userId}:${query.trim().toLowerCase()}`;
  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) queryCache.delete(key);
  return null;
}

function setCachedQuery(userId, query, result) {
  if (queryCache.size >= MAX_CACHE_ENTRIES) {
    queryCache.delete(queryCache.keys().next().value);
  }
  const key = `${userId}:${query.trim().toLowerCase()}`;
  queryCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateAssistantCache(userId) {
  if (!userId) {
    queryCache.clear();
    return;
  }
  const prefix = `${userId}:`;
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

// Process assistant query scoped to current user
exports.queryAssistant = async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query prompt is required' });
    }
    if (query.length > 1500) {
      return res.status(400).json({ success: false, message: 'Keep assistant questions under 1,500 characters.' });
    }

    // Check query cache first for sub-millisecond retrieval
    res.set('Cache-Control', 'private, no-store, max-age=0');
    const cachedResponse = getCachedQuery(userId, query);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const cleanQuery = query.toLowerCase().trim();
    const allFolders = await Folder.find({ userId }).sort({ createdAt: -1 }).lean();

    let matchedItems = [];
    let assistantMessage = '';
    let aiGenerated = false;
    let aiModel = null;
    let aiNotice = '';
    let aiSourceNumbers = new Map();
    let categoryDetected = null;
    const screenshotIntent = /\b(screenshot|screenshots|screen\s*shot|screen\s*shots|snap|snaps)\b/i.test(cleanQuery);

    // Detect target folder intent
    const targetFolder = allFolders.find(f => cleanQuery.includes(f.name.toLowerCase()));

    // Detect target item type intent
    if (cleanQuery.includes('youtube') || cleanQuery.includes('video') || cleanQuery.includes('videos') || cleanQuery.includes('yt')) {
      categoryDetected = 'youtube';
    } else if (screenshotIntent || cleanQuery.includes('image') || cleanQuery.includes('images') || cleanQuery.includes('photo') || cleanQuery.includes('photos') || cleanQuery.includes('picture') || cleanQuery.includes('pictures') || cleanQuery.includes('img')) {
      categoryDetected = 'image';
    } else if (cleanQuery.includes('link') || cleanQuery.includes('links') || cleanQuery.includes('website') || cleanQuery.includes('websites') || cleanQuery.includes('url') || cleanQuery.includes('bookmark') || cleanQuery.includes('bookmarks')) {
      categoryDetected = 'link';
    } else if (cleanQuery.includes('note') || cleanQuery.includes('notes') || cleanQuery.includes('code') || cleanQuery.includes('snippet') || cleanQuery.includes('snippets') || cleanQuery.includes('text')) {
      categoryDetected = 'note';
    } else if (cleanQuery.includes('pdf') || cleanQuery.includes('pdfs') || cleanQuery.includes('document') || cleanQuery.includes('documents') || cleanQuery.includes('paper') || cleanQuery.includes('papers')) {
      categoryDetected = 'pdf';
    }

    const andConditions = [{ userId }];
    if (targetFolder) andConditions.push({ folderId: targetFolder._id });
    if (categoryDetected && !screenshotIntent) {
      andConditions.push({ type: categoryDetected });
    } else if (screenshotIntent) {
      andConditions.push({ type: 'image' });
    }

    const ignoredTerms = new Set([
      'find', 'get', 'show', 'search', 'look', 'for', 'my', 'me', 'all', 'the', 'a', 'an', 'to', 'in', 'on', 'with',
      'important', 'everything', 'anything', 'folder', 'folders', 'item', 'items', 'youtube', 'video',
      'videos', 'yt', 'image', 'images', 'photo', 'photos', 'picture', 'pictures', 'img', 'screenshot', 'screenshots', 'screen', 'shot', 'shots', 'snap', 'snaps', 'link', 'links',
      'website', 'websites', 'url', 'bookmark', 'bookmarks', 'note', 'notes', 'code', 'snippet', 'snippets', 'text', 'pdf', 'pdfs', 'document', 'documents', 'paper', 'papers',
      'what', 'do', 'did', 'have', 'saved', 'vault', 'summarize', 'summary', 'overview', 'details', 'detail', 'about', 'tell', 'everything',
      ...(targetFolder ? targetFolder.name.toLowerCase().split(/\W+/).filter(t => t.length > 0) : [])
    ]);
    const keywordTerms = cleanQuery
      .split(/\W+/)
      .filter((term) => term.length > 2 && !ignoredTerms.has(term));

    // 1. Try High-Performance MongoDB Text Index Search first
    let textMatchedItems = [];
    if (keywordTerms.length > 0 && !screenshotIntent) {
      try {
        const textConditions = { userId, $text: { $search: keywordTerms.join(' ') } };
        if (targetFolder) textConditions.folderId = targetFolder._id;
        if (categoryDetected) textConditions.type = categoryDetected;

        textMatchedItems = await Item.find(
          textConditions,
          { score: { $meta: 'textScore' } }
        )
          .populate('folderId', 'name icon color isPrivate')
          .sort({ score: { $meta: 'textScore' }, pinned: -1, createdAt: -1 })
          .limit(35)
          .lean();
      } catch (err) {
        textMatchedItems = [];
      }
    }

    if (textMatchedItems.length > 0) {
      matchedItems = textMatchedItems;
    } else {
      // 2. High-Recall Regex pipeline fallback
      const orConditions = [];
      if (screenshotIntent) {
        orConditions.push(
          { tags: { $in: ['screenshot', 'snap', 'capture'] } },
          { title: { $regex: 'screenshot|screen|snap', $options: 'i' } },
          { url: { $regex: 'screenshot', $options: 'i' } }
        );
      }
      if (keywordTerms.length > 0) {
        const escapedKeywords = keywordTerms.map(escapeRegex).join('|');
        orConditions.push(
          { title: { $regex: escapedKeywords, $options: 'i' } },
          { content: { $regex: escapedKeywords, $options: 'i' } },
          { ocrText: { $regex: escapedKeywords, $options: 'i' } },
          { url: { $regex: escapedKeywords, $options: 'i' } },
          { tags: { $elemMatch: { $regex: escapedKeywords, $options: 'i' } } }
        );
      }

      const itemQuery = andConditions.length === 1 ? { userId } : { $and: andConditions };
      if (orConditions.length > 0) {
        if (itemQuery.$and) {
          itemQuery.$and.push({ $or: orConditions });
        } else {
          itemQuery.$or = orConditions;
        }
      }

      matchedItems = await Item.find(itemQuery)
        .populate('folderId', 'name icon color isPrivate')
        .sort({ pinned: -1, createdAt: -1 })
        .limit(35)
        .lean();
    }

    // Deterministic relevance scoring; this endpoint does not call a generative model.
    if (keywordTerms.length > 0 && matchedItems.length > 0) {
      matchedItems.forEach(item => {
        let score = (item.score || 0) * 10;
        const lowerTitle = (item.title || '').toLowerCase();
        const lowerContent = (item.content || '').toLowerCase();
        const lowerOcr = (item.ocrText || '').toLowerCase();
        const lowerTags = (item.tags || []).map(t => t.toLowerCase());

        if (lowerTitle.includes(cleanQuery)) score += 25;

        keywordTerms.forEach(term => {
          if (lowerTitle.includes(term)) score += 12;
          if (lowerTags.some(t => t.includes(term))) score += 8;
          if (lowerOcr.includes(term)) score += 8;
          if (lowerContent.includes(term)) score += 6;
        });

        if (item.pinned) score += 5;
        if (item.isFavorite) score += 3;
        item._relevanceScore = score;
      });

      matchedItems.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
    }

    const totalCount = matchedItems.length;

    if (totalCount === 0) {
      assistantMessage = `I searched your personal vault for "${query}", but couldn't find any matching items. Try asking by keyword, folder name, or text from screenshots.`;
    } else {
      let folderContext = targetFolder ? ` inside your "${targetFolder.name}" folder` : '';
      let typeContext = screenshotIntent
        ? ' matching screenshot(s)'
        : (categoryDetected ? ` ${categoryDetected} item(s)` : ' item(s)');

      // Direct Question Answer Extraction (e.g. Wi-Fi password, codes, links, specific values)
      const isQuestion = /\b(what|where|find|password|wifi|code|pin|login|key|secret|token|account|ifsc|link|website|url|site)\b/i.test(cleanQuery);
      const isLinkQuery = /\b(link|website|url|site|web|address)\b/i.test(cleanQuery);
      let directSnippet = '';

      if (isLinkQuery && matchedItems.length > 0) {
        for (const item of matchedItems.slice(0, 10)) {
          let foundUrl = item.metadata?.detectedUrls?.[0];
          if (!foundUrl && item.ocrText) {
            const extracted = extractUrlsFromText(item.ocrText);
            if (extracted.length > 0) foundUrl = extracted[0];
          }
          if (!foundUrl && item.url && !item.url.includes('cloudinary') && !item.url.includes('/uploads/')) {
            foundUrl = item.url;
          }

          if (foundUrl) {
            directSnippet = `Link from "${item.title}":\n[${foundUrl}](${foundUrl})`;
            item.url = foundUrl;
            break;
          }
        }
      }

      if (!directSnippet && isQuestion && matchedItems.length > 0) {
        for (const item of matchedItems.slice(0, 10)) {
          const combinedText = `${item.content || ''}\n${item.ocrText || ''}`.trim();
          if (combinedText) {
            const lines = combinedText.split('\n').map(l => l.trim()).filter(Boolean);
            const foundLine = lines.find(line => {
              const lower = line.toLowerCase();
              return keywordTerms.some(term => lower.includes(term)) ||
                     (cleanQuery.includes('password') && lower.includes('pass')) ||
                     (cleanQuery.includes('wifi') && (lower.includes('wifi') || lower.includes('network')));
            });
            if (foundLine) {
              directSnippet = `Found in "${item.title}":\n"${foundLine}"`;
              break;
            }
          }
        }
      }

      if (directSnippet) {
        assistantMessage = `${directSnippet}\n\nFound ${totalCount}${typeContext}${folderContext}:`;
      } else {
        assistantMessage = `I found ${totalCount}${typeContext}${folderContext} in your vault:`;
      }

      // Ensure every item has its website URL populated from detectedUrls if available
      matchedItems.forEach(item => {
        if (item.metadata?.detectedUrls?.length > 0) {
          item.url = item.metadata.detectedUrls[0];
        } else if (item.ocrText && (!item.url || item.url.includes('cloudinary') || item.url.includes('/uploads/'))) {
          const detected = extractUrlsFromText(item.ocrText);
          if (detected.length > 0) {
            item.url = detected[0];
            if (!item.metadata) item.metadata = {};
            item.metadata.detectedUrls = detected;
          }
        }
      });
    }

    const sensitiveQuery = isSensitiveQuery(query);
    const localOnlyQuery = sensitiveQuery ||
      /\b(link|links|website|websites|url|urls|address)\b/i.test(cleanQuery);
    const privateMatchCount = matchedItems.filter(isPrivateVaultItem).length;

    if (totalCount > 0 && localOnlyQuery) {
      aiNotice = sensitiveQuery
        ? 'Sensitive lookups stay local. Matching vault text is not sent to Cloudflare Workers AI.'
        : 'Link lookups stay local so saved URLs are not sent to Cloudflare Workers AI.';
    } else if (totalCount > 0) {
      try {
        const aiResult = await generateVaultAnswer({ query, items: matchedItems });
        assistantMessage = aiResult.answer;
        aiGenerated = true;
        aiModel = aiResult.model;
        aiSourceNumbers = new Map(aiResult.sources.map((source) => [source.id, source.sourceNumber]));
        if (privateMatchCount > 0) {
          aiNotice = 'Private records stay local and were not included in this AI answer.';
        }
      } catch {
        if (privateMatchCount > 0 && matchedItems.every(isPrivateVaultItem)) {
          aiNotice = 'Private records were kept out of Cloudflare AI. Matching records below are shown only in your signed-in vault.';
        } else {
          aiNotice = 'AI answers are temporarily unavailable; showing matching vault records instead.';
        }
      }
    }

    const responsePayload = {
      success: true,
      query,
      answer: assistantMessage,
      count: totalCount,
      matchedItems: matchedItems.map((item) => {
        const serialized = serializeItem(item);
        const sourceNumber = aiGenerated ? aiSourceNumbers.get(String(item._id)) : null;
        if (sourceNumber) serialized.aiSourceNumber = sourceNumber;
        return serialized;
      }),
      aiGenerated,
      aiModel,
      aiNotice,
      targetFolder: targetFolder ? { id: targetFolder._id, name: targetFolder.name } : null
    };

    setCachedQuery(userId, query, responsePayload);
    res.json(responsePayload);

  } catch (error) {
    console.error('[Search] Vault query failed:', error.message);
    res.status(500).json({ success: false, message: 'Vault search failed. Please try again.' });
  }
};

exports.invalidateAssistantCache = invalidateAssistantCache;
