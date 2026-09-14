/**
 * Simple HTML sanitizer that removes dangerous tags and attributes
 * while preserving safe HTML for rendering blog/help content.
 */

// Tags that are safe to render
const SAFE_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'figure',
  'figcaption', 'span', 'div', 'section', 'article', 'aside',
  'hr', 'sup', 'sub', 'small', 'mark', 'del', 'ins', 'abbr',
  'details', 'summary', 'caption', 'video', 'source',
]);

// Attributes that are safe to keep
const SAFE_ATTRS = new Set([
  'class', 'id', 'href', 'src', 'alt', 'title', 'width', 'height',
  'target', 'rel', 'style', 'colspan', 'rowspan', 'start', 'type',
  'controls', 'autoplay', 'loop', 'muted', 'poster', 'loading',
]);

/**
 * Sanitizes HTML content by removing script tags, event handlers,
 * and other dangerous patterns while preserving safe formatting.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let cleaned = html;

  // Remove <script> tags and their content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove <style> tags and their content (prevents CSS injection)
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove <iframe>, <object>, <embed>, <form>, <input>, <textarea>, <select> tags
  cleaned = cleaned.replace(/<(iframe|object|embed|form|input|textarea|select|button)\b[^>]*\/?>/gi, '');
  cleaned = cleaned.replace(/<\/(iframe|object|embed|form|input|textarea|select|button)>/gi, '');

  // Remove on* event handlers (onclick, onerror, onload, etc.)
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove javascript: and data: protocol URLs
  cleaned = cleaned.replace(/(href|src|action)\s*=\s*["']?\s*javascript:/gi, '$1="');
  cleaned = cleaned.replace(/(href|src|action)\s*=\s*["']?\s*data:(?!image\/(png|jpeg|gif|webp|svg\+xml))/gi, '$1="');

  // Remove base64 encoded content in non-image contexts (potential encoded payloads)
  cleaned = cleaned.replace(/<base\b[^>]*>/gi, '');

  return cleaned;
}

export default sanitizeHtml;
