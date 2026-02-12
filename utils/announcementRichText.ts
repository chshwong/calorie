export const MAX_ANNOUNCEMENT_BODY_LINKS = 10;

const REJECTED_SCHEMES = ['javascript:', 'data:', 'file:', 'intent:', 'vbscript:'] as const;
const CONTROL_OR_WHITESPACE_RE = /[\u0000-\u001F\u007F\s]/;

export type AnnouncementRichTextSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'link';
      text: string;
      url: string;
      isInternal: boolean;
    };

type ParseMeta = {
  hasMalformedLinkSyntax: boolean;
  hasInvalidLinkTarget: boolean;
  processedLinkCount: number;
  maxLinksReached: boolean;
};

type ParseResult = {
  segments: AnnouncementRichTextSegment[];
  meta: ParseMeta;
};

function appendTextSegment(segments: AnnouncementRichTextSegment[], text: string) {
  if (!text) return;
  const prev = segments[segments.length - 1];
  if (prev && prev.type === 'text') {
    prev.text += text;
    return;
  }
  segments.push({ type: 'text', text });
}

function validateAnnouncementLinkTarget(
  rawUrl: string,
  opts?: { allowHttp?: boolean }
): { valid: true; url: string; isInternal: boolean } | { valid: false } {
  const allowHttp = opts?.allowHttp ?? false;
  const url = rawUrl.trim();
  if (!url) return { valid: false };
  if (CONTROL_OR_WHITESPACE_RE.test(url)) return { valid: false };

  const lowered = url.toLowerCase();
  if (REJECTED_SCHEMES.some((scheme) => lowered.startsWith(scheme))) {
    return { valid: false };
  }

  if (url.startsWith('/')) {
    return { valid: true, url, isInternal: true };
  }

  if (lowered.startsWith('mailto:')) {
    return { valid: true, url, isInternal: false };
  }

  if (lowered.startsWith('https://') || (allowHttp && lowered.startsWith('http://'))) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
        return { valid: false };
      }
      return { valid: true, url, isInternal: false };
    } catch {
      return { valid: false };
    }
  }

  return { valid: false };
}

export function parseAnnouncementBodyRichText(
  body: string,
  opts?: { maxLinks?: number; allowHttp?: boolean }
): ParseResult {
  if (!body) {
    return {
      segments: [],
      meta: {
        hasMalformedLinkSyntax: false,
        hasInvalidLinkTarget: false,
        processedLinkCount: 0,
        maxLinksReached: false,
      },
    };
  }

  const maxLinks = Math.max(0, opts?.maxLinks ?? MAX_ANNOUNCEMENT_BODY_LINKS);
  const segments: AnnouncementRichTextSegment[] = [];
  const meta: ParseMeta = {
    hasMalformedLinkSyntax: false,
    hasInvalidLinkTarget: false,
    processedLinkCount: 0,
    maxLinksReached: false,
  };

  let cursor = 0;
  while (cursor < body.length) {
    const openBracket = body.indexOf('[', cursor);
    if (openBracket === -1) {
      appendTextSegment(segments, body.slice(cursor));
      break;
    }

    if (meta.processedLinkCount >= maxLinks) {
      meta.maxLinksReached = true;
      appendTextSegment(segments, body.slice(cursor));
      break;
    }

    appendTextSegment(segments, body.slice(cursor, openBracket));

    const closeBracket = body.indexOf(']', openBracket + 1);
    if (closeBracket === -1) {
      appendTextSegment(segments, body.slice(openBracket));
      break;
    }

    if (closeBracket + 1 >= body.length || body[closeBracket + 1] !== '(') {
      appendTextSegment(segments, body.slice(openBracket, openBracket + 1));
      cursor = openBracket + 1;
      continue;
    }

    const closeParen = body.indexOf(')', closeBracket + 2);
    if (closeParen === -1) {
      meta.hasMalformedLinkSyntax = true;
      appendTextSegment(segments, body.slice(openBracket));
      break;
    }

    const label = body.slice(openBracket + 1, closeBracket);
    const rawUrl = body.slice(closeBracket + 2, closeParen);

    if (!label || !rawUrl) {
      meta.hasMalformedLinkSyntax = true;
      appendTextSegment(segments, body.slice(openBracket, closeParen + 1));
      cursor = closeParen + 1;
      continue;
    }

    const safeTarget = validateAnnouncementLinkTarget(rawUrl, { allowHttp: opts?.allowHttp ?? false });
    if (!safeTarget.valid) {
      meta.hasInvalidLinkTarget = true;
      appendTextSegment(segments, `${label} (${rawUrl})`);
      cursor = closeParen + 1;
      continue;
    }

    segments.push({
      type: 'link',
      text: label,
      url: safeTarget.url,
      isInternal: safeTarget.isInternal,
    });
    meta.processedLinkCount += 1;
    cursor = closeParen + 1;
  }

  return { segments, meta };
}

export function projectAnnouncementBodyPlainText(
  body: string,
  opts?: { maxLinks?: number; maxLength?: number; allowHttp?: boolean }
): string {
  const parsed = parseAnnouncementBodyRichText(body, {
    maxLinks: opts?.maxLinks,
    allowHttp: opts?.allowHttp,
  });
  const plain = parsed.segments.map((segment) => segment.text).join('');
  const normalized = plain.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const maxLength = opts?.maxLength ?? 120;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function validateAnnouncementBodyRichText(
  body: string,
  opts?: { maxLinks?: number; allowHttp?: boolean }
): { valid: true } | { valid: false; errorKey: string } {
  const parsed = parseAnnouncementBodyRichText(body, {
    maxLinks: opts?.maxLinks,
    allowHttp: opts?.allowHttp,
  });

  if (parsed.meta.hasMalformedLinkSyntax || parsed.meta.hasInvalidLinkTarget) {
    return { valid: false, errorKey: 'settings.admin.validation_body_links' };
  }

  return { valid: true };
}
