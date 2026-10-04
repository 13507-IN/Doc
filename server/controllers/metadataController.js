const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');

const metadataCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

function getCachedMetadata(url) {
  const cached = metadataCache.get(url);
  if (!cached || cached.expiresAt < Date.now()) {
    metadataCache.delete(url);
    return null;
  }
  return cached.value;
}

function cacheMetadata(url, value) {
  if (metadataCache.size >= MAX_CACHE_ENTRIES) {
    metadataCache.delete(metadataCache.keys().next().value);
  }
  metadataCache.set(url, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80')) return true;
    if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
  }

  return false;
}

async function assertPublicHttpUrl(parsedUrl) {
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('Only public HTTP(S) URLs are supported');
  }

  const hostname = parsedUrl.hostname;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local network URLs are not supported');
  }

  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Local network URLs are not supported');
  }
}

// Extract YouTube ID from various YouTube URL formats
function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Extract rich metadata from a URL (YouTube video or website)
exports.extractMetadata = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'A valid URL is required' });
    }
    try {
      await assertPublicHttpUrl(parsedUrl);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const cached = getCachedMetadata(parsedUrl.href);
    if (cached) return res.json(cached);

    // Check if URL directly points to a PDF document
    if (parsedUrl.pathname.toLowerCase().endsWith('.pdf')) {
      const rawName = decodeURIComponent(parsedUrl.pathname.split('/').pop() || 'document.pdf');
      const cleanTitle = rawName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'PDF Document';
      const responsePayload = {
        success: true,
        type: 'pdf',
        title: cleanTitle,
        previewUrl: '',
        metadata: {
          filename: rawName,
          mimeType: 'application/pdf',
          sourceUrl: parsedUrl.href
        }
      };
      cacheMetadata(parsedUrl.href, responsePayload);
      return res.json(responsePayload);
    }

    const youtubeId = extractYouTubeId(parsedUrl.href);

    if (youtubeId) {
      // Fetch oEmbed data from YouTube
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
        const { data } = await axios.get(oembedUrl, { timeout: 5000 });

        const responsePayload = {
          success: true,
          type: 'youtube',
          youtubeId,
          title: data.title || 'YouTube Video',
          authorName: data.author_name || '',
          previewUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
          fallbackPreviewUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
          metadata: {
            authorName: data.author_name,
            authorUrl: data.author_url,
            html: data.html
          }
        };
        cacheMetadata(parsedUrl.href, responsePayload);
        return res.json(responsePayload);
      } catch (err) {
        // Fallback for YouTube
        return res.json({
          success: true,
          type: 'youtube',
          youtubeId,
          title: 'YouTube Video',
          previewUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
          metadata: {}
        });
      }
    }

    // Standard Website OpenGraph extraction
    try {
      const response = await axios.get(parsedUrl.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 5000,
        maxContentLength: 1024 * 1024,
        maxBodyLength: 1024 * 1024,
        maxRedirects: 0
      });

      const $ = cheerio.load(response.data);
      const title = $('meta[property="og:title"]').attr('content') ||
                    $('title').text() ||
                    $('meta[name="twitter:title"]').attr('content') ||
                    parsedUrl.href;

      const description = $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="description"]').attr('content') ||
                          $('meta[name="twitter:description"]').attr('content') || '';

      const previewUrl = $('meta[property="og:image"]').attr('content') ||
                         $('meta[name="twitter:image"]').attr('content') || '';

      const siteName = $('meta[property="og:site_name"]').attr('content') || parsedUrl.hostname;

      const responsePayload = {
        success: true,
        type: 'link',
        title: title.trim(),
        description: description.trim(),
        previewUrl,
        siteName,
        metadata: { siteName, description }
      };
      cacheMetadata(parsedUrl.href, responsePayload);
      return res.json(responsePayload);
    } catch (err) {
      const hostname = parsedUrl.hostname;
      return res.json({
        success: true,
        type: 'link',
        title: hostname,
        description: '',
        previewUrl: '',
        siteName: hostname,
        metadata: { siteName: hostname }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
