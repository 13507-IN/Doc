'use client';
import React from 'react';
import { ensureAbsoluteUrl } from '../utils/urlHelper';

export default function ClickableText({ text, linkStyle = {}, className = '' }) {
  if (!text) return null;

  // Pattern to match Markdown links [Title](https://...) OR raw URLs (https://..., www...., or domains with known TLDs)
  const tokenRegex = /(\[[^\]]+\]\([^\)]+\)|https?:\/\/[^\s<>"'{}|\\^`[\]]+|www\.[^\s<>"'{}|\\^`[\]]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|org|net|io|co|ai|dev|app|edu|gov|in|me|info|tv)(?:\/[^\s<>"'{}|\\^`[\]]*)?)/gi;

  const parts = String(text).split(tokenRegex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;

        // 1. Check for markdown link [Label](url)
        const mdMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (mdMatch) {
          const label = mdMatch[1];
          const rawUrl = mdMatch[2];
          const href = ensureAbsoluteUrl(rawUrl);
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: '#60a5fa',
                textDecoration: 'underline',
                fontWeight: 600,
                wordBreak: 'break-all',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                ...linkStyle
              }}
            >
              <span>{label}</span>
              <span style={{ fontSize: '10px' }}>↗</span>
            </a>
          );
        }

        // 2. Check for raw URL or domain
        const isUrl = /^(https?:\/\/|www\.)/i.test(part) || /\.(com|org|net|io|co|ai|dev|app|edu|gov|in|me|info|tv)($|\/)/i.test(part);
        if (isUrl) {
          const cleanUrl = part.replace(/[.,;:)\]]+$/, '');
          const trailing = part.slice(cleanUrl.length);
          const href = ensureAbsoluteUrl(cleanUrl);

          return (
            <React.Fragment key={index}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: '#60a5fa',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  wordBreak: 'break-all',
                  cursor: 'pointer',
                  ...linkStyle
                }}
              >
                {cleanUrl} ↗
              </a>
              {trailing}
            </React.Fragment>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}
