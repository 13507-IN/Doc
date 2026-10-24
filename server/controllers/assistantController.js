const Item = require('../models/Item');
const Folder = require('../models/Folder');

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
    const keywords = keywordTerms.join(' ');

    const orConditions = [];
    if (screenshotIntent) {
      orConditions.push(
        { tags: { $in: ['screenshot', 'snap', 'capture'] } },
        { title: { $regex: 'screenshot|screen|snap', $options: 'i' } },
        { url: { $regex: 'screenshot', $options: 'i' } }
      );
    }
    if (keywords.length > 2) {
      orConditions.push(
        { $text: { $search: keywords } },
        { title: { $regex: keywords.replace(/\s+/g, '|'), $options: 'i' } },
        { content: { $regex: keywords.replace(/\s+/g, '|'), $options: 'i' } },
        { ocrText: { $regex: keywords.replace(/\s+/g, '|'), $options: 'i' } },
        { tags: { $elemMatch: { $regex: keywords.replace(/\s+/g, '|'), $options: 'i' } } }
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
      .limit(30)
      .lean();

    const totalCount = matchedItems.length;

    if (totalCount === 0) {
      assistantMessage = `I searched your personal vault for "${query}", but couldn't find any matching items. Try being more specific (e.g., folder name, filename, or keywords from text/OCR).`;
    } else {
      let folderContext = targetFolder ? ` inside your "${targetFolder.name}" folder` : '';
      let typeContext = screenshotIntent
        ? ' matching screenshot(s)'
        : (categoryDetected ? ` ${categoryDetected} item(s)` : ' item(s)');
      
      assistantMessage = `I found ${totalCount}${typeContext}${folderContext} for you!`;
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
    res.status(500).json({ success: false, message: error.message });
  }
};
