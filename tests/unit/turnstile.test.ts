import { describe, expect, it, vi } from 'vitest';

import { verifyTurnstile } from '../../functions/_shared/turnstile';

const BASE_INPUT = {
  secretKey: 'test-secret',
  siteKey: 'test-site-key',
  token: 'test-token',
};

describe('Turnstile verification', () => {
  it('posts secret, response and remote IP to Siteverify', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      const body = init?.body as URLSearchParams;

      expect(body.get('secret')).toBe('test-secret');
      expect(body.get('response')).toBe('test-token');
      expect(body.get('remoteip')).toBe('203.0.113.10');

      return Response.json({ success: true });
    });

    await expect(
      verifyTurnstile({
        ...BASE_INPUT,
        remoteIp: '203.0.113.10',
        fetcher,
      }),
    ).resolves.toBe('success');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects a missing token without calling Siteverify', async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      verifyTurnstile({
        ...BASE_INPUT,
        token: undefined,
        fetcher,
      }),
    ).resolves.toBe('failed');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns failed when Siteverify rejects the token', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ success: false, 'error-codes': ['invalid-input-response'] }),
    );

    await expect(
      verifyTurnstile({
        ...BASE_INPUT,
        fetcher,
      }),
    ).resolves.toBe('failed');
  });

  it('returns unavailable on a Siteverify network error', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('network unavailable');
    });

    await expect(
      verifyTurnstile({
        ...BASE_INPUT,
        fetcher,
      }),
    ).resolves.toBe('unavailable');
  });

  it('aborts Siteverify after the configured timeout', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    await expect(
      verifyTurnstile({
        ...BASE_INPUT,
        fetcher,
        timeoutMs: 5,
      }),
    ).resolves.toBe('unavailable');
  });

  it.each([
    { secretKey: undefined, siteKey: 'test-site-key' },
    { secretKey: 'test-secret', siteKey: undefined },
  ])('handles missing Turnstile configuration safely', async (configuration) => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      verifyTurnstile({
        ...BASE_INPUT,
        ...configuration,
        fetcher,
      }),
    ).resolves.toBe('unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
