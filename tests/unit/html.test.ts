import { describe, expect, it } from 'vitest';

import { escapeHtml } from '../../functions/_shared/html';

describe('escapeHtml', () => {
  it.each([
    ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['Jan & Anna', 'Jan &amp; Anna'],
    ['"cytat"', '&quot;cytat&quot;'],
    ["apostrof '", 'apostrof &#39;'],
    ['Zażółć gęślą jaźń', 'Zażółć gęślą jaźń'],
  ])('escapes %s without removing text', (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });
});
