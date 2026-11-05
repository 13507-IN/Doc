'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const PRIVATE_MEDIA_PATH = /\/api\/(?:items|uploads)\/[^/?#]+\/media(?:[?#]|$)/i;

function isPrivateMediaUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  if (PRIVATE_MEDIA_PATH.test(value)) return true;
  try {
    return PRIVATE_MEDIA_PATH.test(new URL(value, API_BASE).pathname);
  } catch {
    return PRIVATE_MEDIA_PATH.test(value);
  }
}

function resolveMediaUrl(value) {
  const apiBase = new URL(API_BASE, window.location.origin);
  const path = new URL(value, window.location.origin);
  if (path.origin === window.location.origin && path.pathname.startsWith('/api/')) {
    return new URL(path.pathname + path.search, apiBase.origin).toString();
  }
  return path.toString();
}

export default function usePrivateMediaUrl(source, token) {
  const [loaded, setLoaded] = useState({ source: null, url: null });

  useEffect(() => {
    let objectUrl;
    let active = true;
    const controller = new AbortController();

    queueMicrotask(() => {
      if (active) setLoaded({ source: null, url: null });
    });

    if (!source || !isPrivateMediaUrl(source)) {
      return () => {
        active = false;
        controller.abort();
      };
    }

    const fetchMedia = async () => {
      const activeToken = token || localStorage.getItem('holder_token');
      if (!activeToken) return;

      try {
        const response = await fetch(resolveMediaUrl(source), {
          method: 'GET',
          headers: { Authorization: `Bearer ${activeToken}` },
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Private media request failed (${response.status})`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setLoaded({ source, url: objectUrl });
        } else {
          URL.revokeObjectURL(objectUrl);
          objectUrl = undefined;
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') setLoaded({ source, url: null });
      }
    };

    fetchMedia();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, token]);

  if (!source) return null;
  if (!isPrivateMediaUrl(source)) return source;
  return loaded.source === source ? loaded.url : null;
}
