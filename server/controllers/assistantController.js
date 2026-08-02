const Item = require('../models/Item');
const Folder = require('../models/Folder');

// Process assistant query and return AI answer + relevant matching items
exports.queryAssistant = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Query prompt is required' });
    }

    const cleanQuery = query.toLowerCase().trim();
    const allItems = await Item.find().populate('folderId', 'name icon color');
    const allFolders = await Folder.find();

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

    // Filter matching items
    matchedItems = allItems.filter(item => {
      let matches = true;

      // Filter by folder if specified
      if (targetFolder) {
        matches = matches && (item.folderId && item.folderId._id.toString() === targetFolder._id.toString());
      }

      // Filter by category if specified
      if (categoryDetected) {
        matches = matches && item.type === categoryDetected;
      }

      // Filter by keyword search if not purely folder/category query
      const keywords = cleanQuery
        .replace(/find|get|show|my|me|all|important|everything|anything|folder|items|videos|links|notes|images/gi, '')
        .trim();

      if (keywords.length > 2) {
        const itemText = `${item.title} ${item.content} ${item.url} ${item.tags.join(' ')}`.toLowerCase();
        matches = matches && itemText.includes(keywords);
      }

      return matches;
    });

    // Fallback: If strict query returned no items, attempt broader fuzzy match
    if (matchedItems.length === 0 && cleanQuery.length > 0) {
      const searchTerms = cleanQuery.split(' ').filter(w => w.length > 2);
      matchedItems = allItems.filter(item => {
        const itemText = `${item.title} ${item.content} ${item.url} ${item.tags.join(' ')}`.toLowerCase();
        return searchTerms.some(term => itemText.includes(term));
      });
    }

    // Generate dynamic response text
    const totalCount = matchedItems.length;

    if (totalCount === 0) {
      assistantMessage = `I searched your vault for "${query}", but couldn't find any directly matching items. Try creating a new note or saving a link in a folder!`;
    } else {
      let folderContext = targetFolder ? ` inside your "${targetFolder.name}" folder` : '';
      let typeContext = categoryDetected ? ` ${categoryDetected} items` : ' items';
      
      assistantMessage = `I retrieved ${totalCount}${typeContext}${folderContext} for you! Here is what I found:`;
    }

    res.json({
      success: true,
      query,
      answer: assistantMessage,
      count: totalCount,
      matchedItems: matchedItems.slice(0, 20), // return top 20
      targetFolder: targetFolder ? { id: targetFolder._id, name: targetFolder.name } : null
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
