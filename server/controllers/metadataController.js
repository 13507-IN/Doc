const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');

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

function ipv6ToBigInt(address) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized.includes('.')) return null;

  const sections = normalized.split('::');
  if (sections.length > 2) return null;
  const left = sections[0] ? sections[0].split(':') : [];
  const right = sections[1] ? sections[1].split(':') : [];
  const groups = sections.length === 1
    ? left
    : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[a-f\d]{1,4}$/i.test(group))) return null;

  return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group}`), 0n);
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = address.split('.').map(Number)
      .reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
    const inRange = (network, prefix) => {
      const base = network.split('.').map(Number)
        .reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
      const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      return ((value & mask) >>> 0) === ((base & mask) >>> 0);
    };
    return [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.0.2.0', 24],
      ['192.88.99.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['198.51.100.0', 24],
      ['203.0.113.0', 24],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4]
    ].some(([network, prefix]) => inRange(network, prefix));
  }

  if (family === 6) {
    const normalized = address.toLowerCase().split('%')[0];
    const value = ipv6ToBigInt(normalized);
    if (value === null) return true;
    const inRange = (network, prefix) => {
      const base = ipv6ToBigInt(network);
      if (base === null) return true;
      const shift = BigInt(128 - prefix);
      return (value >> shift) === (base >> shift);
    };
    return (
      !inRange('2000::', 3) ||
      inRange('2001::', 23) ||
      inRange('2001:db8::', 32) ||
      inRange('2002::', 16) ||
      inRange('3fff::', 20)
    );
  }

  return true;
}

async function assertPublicHttpUrl(parsedUrl) {
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('Only public HTTP(S) URLs are supported');
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local network URLs are not supported');
  }

  const directFamily = net.isIP(hostname);
  try {
    const addresses = directFamily
      ? [{ address: hostname, family: directFamily }]
      : await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error('Local network URLs are not supported');
    }
    return addresses;
  } catch (err) {
    if (err.message === 'Local network URLs are not supported') throw err;
    throw new Error('The website hostname could not be safely verified');
  }
}

function createPinnedAgent(parsedUrl, addresses) {
  const expectedHost = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const lookup = (hostname, options, callback) => {
    const actualHost = String(hostname).replace(/^\[|\]$/g, '').toLowerCase();
    if (actualHost !== expectedHost) {
      return callback(new Error('Website hostname changed during request'));
    }
    if (options?.all) {
      return callback(null, addresses.map(({ address, family }) => ({ address, family })));
    }
    const selected = addresses[0];
    return callback(null, selected.address, selected.family);
  };
  const Agent = parsedUrl.protocol === 'https:' ? https.Agent : http.Agent;
  return new Agent({ keepAlive: false, maxSockets: 1, lookup });
}

async function fetchPublicHttpStream(initialUrl, requestOptions) {
  let currentUrl = new URL(initialUrl.href);
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const addresses = await assertPublicHttpUrl(currentUrl);
    const agent = createPinnedAgent(currentUrl, addresses);
    let response;
    try {
      response = await axios.get(currentUrl.href, {
        ...requestOptions,
        httpAgent: currentUrl.protocol === 'http:' ? agent : undefined,
        httpsAgent: currentUrl.protocol === 'https:' ? agent : undefined,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
    } catch (error) {
      agent.destroy();
      throw error;
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      response.data?.destroy?.();
      agent.destroy();
      if (!location || redirectCount === 5) {
        throw new Error('The website redirected too many times');
      }
      try {
        currentUrl = new URL(location, currentUrl);
      } catch {
        throw new Error('The website returned an invalid redirect');
      }
      continue;
    }

    return { response, agent, finalUrl: currentUrl };
  }
  throw new Error('The website redirected too many times');
}

// Extract YouTube ID from various YouTube URL formats
function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function generateSmartTags(url, title = '', description = '', type = 'link', authorName = '') {
  const tags = new Set();
  const text = `${title} ${description} ${authorName}`.toLowerCase();

  if (type === 'youtube') {
    tags.add('youtube');
    tags.add('video');
    if (authorName) {
      const cleanAuthor = authorName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanAuthor) tags.add(cleanAuthor);
    }
  }

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const domainPrefix = hostname.split('.')[0];
    if (domainPrefix && domainPrefix.length > 2 && !['com', 'org', 'net', 'io'].includes(domainPrefix)) {
      tags.add(domainPrefix);
    }
  } catch {}

  const topics = [
    { tag: 'ai', pattern: /\b(ai|llm|gpt|openai|machine learning|deep learning|gemini|claude)\b/i },
    { tag: 'design', pattern: /\b(design|ui|ux|figma|typography|dribbble|palette|brand|logo)\b/i },
    { tag: 'code', pattern: /\b(github|code|programming|javascript|python|react|nextjs|developer|api|dev)\b/i },
    { tag: 'tutorial', pattern: /\b(how to|guide|tutorial|crash course|step by step|learn|course)\b/i },
    { tag: 'business', pattern: /\b(startup|finance|revenue|marketing|saas|founder|growth)\b/i },
    { tag: 'productivity', pattern: /\b(productivity|workflow|tools|tips|system|vault)\b/i },
    { tag: 'docs', pattern: /\b(documentation|docs|reference|cheatsheet|spec)\b/i }
  ];

  for (const { tag, pattern } of topics) {
    if (pattern.test(text)) tags.add(tag);
  }

  return Array.from(tags).slice(0, 6);
}

function generateSmartSummary(description = '') {
  if (!description || description.trim().length < 20) return '';
  const sentences = description.replace(/\s+/g, ' ').split(/[.!?]\s+/).filter(s => s.trim().length > 15);
  if (!sentences.length) return description.trim().slice(0, 240);
  return sentences.slice(0, 3).map(s => `• ${s.trim()}`).join('\n');
}

// Extract rich metadata from a URL (YouTube video, PDF, or website)
exports.extractMetadata = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const url = body.url;
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({ success: false, message: 'A valid URL is required' });
    }

    // 1. Fast Cache Check: 0ms return if already fetched
    const cached = getCachedMetadata(parsedUrl.href);
    if (cached) return res.json(cached);

    try {
      await assertPublicHttpUrl(parsedUrl);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // 2. Direct PDF document check
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

    // 3. YouTube link check
    const youtubeId = extractYouTubeId(parsedUrl.href);
    if (youtubeId) {
      const defaultPreview = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
      const fallbackPreview = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
        const { data } = await axios.get(oembedUrl, { timeout: 2500 });

        const rawTitle = data.title || 'YouTube Video';
        const authorName = data.author_name || '';
        const suggestedTags = generateSmartTags(parsedUrl.href, rawTitle, '', 'youtube', authorName);

        const responsePayload = {
          success: true,
          type: 'youtube',
          youtubeId,
          title: rawTitle,
          authorName,
          previewUrl: defaultPreview,
          fallbackPreviewUrl: fallbackPreview,
          embedUrl: `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
          suggestedTags,
          suggestedFolderType: 'youtube',
          metadata: {
            authorName,
            authorUrl: data.author_url,
            html: data.html
          }
        };
        cacheMetadata(parsedUrl.href, responsePayload);
        return res.json(responsePayload);
      } catch (err) {
        const fallbackTags = generateSmartTags(parsedUrl.href, 'YouTube Video', '', 'youtube', '');
        const fallbackPayload = {
          success: true,
          type: 'youtube',
          youtubeId,
          title: 'YouTube Video',
          previewUrl: fallbackPreview,
          embedUrl: `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
          suggestedTags: fallbackTags,
          suggestedFolderType: 'youtube',
          metadata: {}
        };
        cacheMetadata(parsedUrl.href, fallbackPayload);
        return res.json(fallbackPayload);
      }
    }

    // 4. Ultra-Fast Streamed Website OpenGraph Extraction
    // Streams only the <head> section (up to ~200KB) and cancels stream immediately
    try {
      const { response, agent } = await fetchPublicHttpStream(parsedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
      responseType: 'stream',
        timeout: 3500,
        proxy: false
      });

      let html = '';
      await new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          if (!finished) {
            finished = true;
            try { response.data.destroy(); } catch (e) {}
            agent.destroy();
            resolve();
          }
        };

        response.data.on('data', (chunk) => {
          html += chunk.toString('utf8');
          if (html.includes('</head>') || html.length >= 250000) {
            finish();
          }
        });

        response.data.on('end', finish);
        response.data.on('close', finish);
        response.data.on('error', finish);
      });

      const $ = cheerio.load(html);
      const title = $('meta[property="og:title"]').attr('content') ||
                    $('title').text() ||
                    $('meta[name="twitter:title"]').attr('content') ||
                    parsedUrl.hostname;

      const description = $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="description"]').attr('content') ||
                          $('meta[name="twitter:description"]').attr('content') || '';

      const previewUrl = $('meta[property="og:image"]').attr('content') ||
                         $('meta[name="twitter:image"]').attr('content') || '';

      const siteName = $('meta[property="og:site_name"]').attr('content') || parsedUrl.hostname;

      const cleanTitle = title.trim();
      const cleanDesc = description.trim();
      const suggestedTags = generateSmartTags(parsedUrl.href, cleanTitle, cleanDesc, 'link', siteName);
      const smartSummary = generateSmartSummary(cleanDesc);

      const isBrandAsset = /\b(figma|dribbble|behance|logo|brand|design system|colors)\b/i.test(`${cleanTitle} ${cleanDesc} ${parsedUrl.hostname}`);
      const suggestedFolderType = isBrandAsset ? 'brand' : 'web';

      const responsePayload = {
        success: true,
        type: 'link',
        title: cleanTitle,
        description: cleanDesc,
        previewUrl,
        siteName,
        suggestedTags,
        smartSummary,
        suggestedFolderType,
        metadata: { siteName, description: cleanDesc, smartSummary }
      };

      cacheMetadata(parsedUrl.href, responsePayload);
      return res.json(responsePayload);
    } catch (err) {
      const hostname = parsedUrl.hostname;
      const fallbackTags = generateSmartTags(parsedUrl.href, hostname, '', 'link');
      const fallbackPayload = {
        success: true,
        type: 'link',
        title: hostname,
        description: '',
        previewUrl: '',
        siteName: hostname,
        suggestedTags: fallbackTags,
        suggestedFolderType: 'web',
        metadata: { siteName: hostname }
      };
      cacheMetadata(parsedUrl.href, fallbackPayload);
      return res.json(fallbackPayload);
    }
  } catch (error) {
    console.error('[Metadata] Extraction failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not retrieve metadata for this URL.' });
  }
};

exports.isPrivateAddress = isPrivateAddress;
exports.assertPublicHttpUrl = assertPublicHttpUrl;
