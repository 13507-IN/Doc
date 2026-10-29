const Item = require('../models/Item');
const Folder = require('../models/Folder');
const { extractUrlsFromText } = require('../services/ocrService');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Process assistant query scoped to current user
exports.queryAssistant = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Query prompt is required' });
    }

    const cleanQuery = query.toLowerCase().trim();
    const allFolders = await Folder.find({ userId }).lean();

    let matchedItems = [];
    let assistantMessage = '';
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
      ...(targetFolder ? targetFolder.name.toLowerCase().split(/\W+/).filter(t => t.length > 0) : [])
    ]);
    const keywordTerms = cleanQuery
      .split(/\W+/)
      .filter((term) => term.length > 2 && !ignoredTerms.has(term));

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
      .populate('folderId', 'name icon color')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(35)
      .lean();

    // AI Relevance Ranking
    if (keywordTerms.length > 0 && matchedItems.length > 0) {
      matchedItems.forEach(item => {
        let score = 0;
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
        for (const item of matchedItems) {
          let foundUrl = item.metadata?.detectedUrls?.[0];
          if (!foundUrl && item.ocrText) {
            const extracted = extractUrlsFromText(item.ocrText);
            if (extracted.length > 0) foundUrl = extracted[0];
          }
          if (!foundUrl && item.url && !item.url.includes('cloudinary') && !item.url.includes('/uploads/')) {
            foundUrl = item.url;
          }

          if (foundUrl) {
            directSnippet = `🌐 Link from "${item.title}":\n[${foundUrl}](${foundUrl})`;
            item.url = foundUrl;
            break;
          }
        }
      }

      if (!directSnippet && isQuestion && matchedItems.length > 0) {
        for (const item of matchedItems.slice(0, 3)) {
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
              directSnippet = `💡 Extracted from "${item.title}":\n"${foundLine}"`;
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

    res.json({
      success: true,
      query,
      answer: assistantMessage,
      count: totalCount,
      matchedItems,
      targetFolder: targetFolder ? { id: targetFolder._id, name: targetFolder.name } : null
    });

  } catch (error) {
    console.error('Error in queryAssistant:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
