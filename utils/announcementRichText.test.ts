import { describe, expect, it } from 'vitest';

import {
    parseAnnouncementBodyRichText,
    projectAnnouncementBodyPlainText,
    validateAnnouncementBodyRichText,
} from './announcementRichText';

describe('announcementRichText', () => {
  it('parses mixed text and safe links', () => {
    const parsed = parseAnnouncementBodyRichText(
      'See [Docs](https://example.com) and [Friends](/friends) now.'
    );

    expect(parsed.meta.hasMalformedLinkSyntax).toBe(false);
    expect(parsed.meta.hasInvalidLinkTarget).toBe(false);
    expect(parsed.segments).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'Docs', url: 'https://example.com', isInternal: false },
      { type: 'text', text: ' and ' },
      { type: 'link', text: 'Friends', url: '/friends', isInternal: true },
      { type: 'text', text: ' now.' },
    ]);
  });

  it('converts valid markdown links to plain preview text', () => {
    const preview = projectAnnouncementBodyPlainText(
      'New post: [Read more](https://example.com/updates/today)'
    );

    expect(preview).toBe('New post: Read more');
  });

  it('rejects unsafe schemes and reports validation error', () => {
    const parsed = parseAnnouncementBodyRichText('Do [not click](javascript:alert(1)).');
    expect(parsed.meta.hasInvalidLinkTarget).toBe(true);
    expect(parsed.segments.map((segment) => segment.text).join('')).toContain('not click (javascript:alert(1)');

    const validation = validateAnnouncementBodyRichText('Do [not click](javascript:alert(1)).');
    expect(validation).toEqual({
      valid: false,
      errorKey: 'settings.admin.validation_body_links',
    });
  });

  it('rejects malformed markdown link syntax', () => {
    const validation = validateAnnouncementBodyRichText('Broken [link](https://example.com');
    expect(validation).toEqual({
      valid: false,
      errorKey: 'settings.admin.validation_body_links',
    });
  });

  it('caps parsed links and treats remainder as plain text', () => {
    const body =
      '[L1](https://a.com) [L2](https://b.com) [L3](https://c.com) [L4](https://d.com) [L5](https://e.com) [L6](https://f.com) [L7](https://g.com) [L8](https://h.com) [L9](https://i.com) [L10](https://j.com) [L11](https://k.com)';
    const parsed = parseAnnouncementBodyRichText(body, { maxLinks: 10 });

    const linkSegments = parsed.segments.filter((segment) => segment.type === 'link');
    expect(linkSegments).toHaveLength(10);
    expect(parsed.meta.maxLinksReached).toBe(true);
    expect(parsed.segments.map((segment) => segment.text).join('')).toContain('[L11](https://k.com)');
  });
});
