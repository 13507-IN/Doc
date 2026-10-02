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

    // Detect target folder intent
    const targetFolder = allFolders.find(f => cleanQuery.includes(f.name.toLowerCase()));

    // Detect target item type intent
    if (cleanQuery.includes('youtube') || cleanQuery.includes('video') || cleanQuery.includes('videos')) {
      categoryDetected = 'youtube';
    } else if (cleanQuery.includes('image') || cleanQuery.includes('photo') || cleanQuery.includes('picture')) {
      categoryDetected = 'image';
    } else if (cleanQuery.includes('link') || cleanQuery.includes('website') || cleanQuery.includes('url')) {
      categoryDetected = 'link';
    } else if (cleanQuery.includes('note') || cleanQuery.includes('code') || cleanQuery.includes('text')) {
      categoryDetected = 'note';
    }

    const itemQuery = { userId };
    if (targetFolder) itemQuery.folderId = targetFolder._id;
    if (categoryDetected) itemQuery.type = categoryDetected;

    const ignoredTerms = new Set([
      'find', 'get', 'show', 'my', 'me', 'all', 'important', 'everything',
      'anything', 'folder', 'folders', 'item', 'items', 'youtube', 'video',
      'videos', 'image', 'images', 'photo', 'picture', 'link', 'links',
      'website', 'url', 'note', 'notes', 'code', 'text',
      ...(targetFolder ? targetFolder.name.toLowerCase().split(/\W+/) : [])
    ]);
    const keywords = cleanQuery
      .split(/\W+/)
      .filter((term) => term.length > 2 && !ignoredTerms.has(term))
      .join(' ');
    if (keywords.length > 2) itemQuery.$text = { $search: keywords };

    matchedItems = await Item.find(itemQuery)
      .populate('folderId', 'name icon color')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(20)
      .lean();

    const totalCount = matchedItems.length;

    if (totalCount === 0) {
      assistantMessage = `I searched your personal vault for "${query}", but couldn't find any matching items.`;
    } else {
      let folderContext = targetFolder ? ` inside your "${targetFolder.name}" folder` : '';
      let typeContext = categoryDetected ? ` ${categoryDetected} items` : ' items';
      
      assistantMessage = `I retrieved ${totalCount}${typeContext}${folderContext} for you!`;
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
