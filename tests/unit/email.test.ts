import { describe, expect, it, vi } from 'vitest';

import { sendBookingEmails } from '../../functions/_shared/email';
import type { EmailContent } from '../../functions/_shared/email-templates';

const CONTENT: EmailContent = {
  subject: 'Test subject',
  html: '<p>Safe HTML</p>',
  text: 'Safe text',
};

const ENVIRONMENT = {
  RESEND_API_KEY: 'test-resend-key',
  RESEND_FROM_EMAIL: 'Brzytwa <booking@example.com>',
  ADMIN_NOTIFICATION_EMAIL: 'admin@example.com',
};

function recipientFromRequest(init: RequestInit | undefined): string {
  const payload = JSON.parse(String(init?.body)) as {
    to: string[];
    html: string;
    text: string;
  };

  expect(payload.html).toBe(CONTENT.html);
  expect(payload.text).toBe(CONTENT.text);

  return payload.to[0] ?? '';
}

describe('Resend booking delivery', () => {
  it('sends customer and admin HTML/plain-text emails', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://api.resend.com/emails');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-resend-key');
      expect(recipientFromRequest(init)).toMatch(/^(jan@example\.com|admin@example\.com)$/);

      return new Response(null, { status: 200 });
    });

    await expect(
      sendBookingEmails({
        environment: ENVIRONMENT,
        customerEmail: 'jan@example.com',
        customerContent: CONTENT,
        adminContent: CONTENT,
        fetcher,
      }),
    ).resolves.toEqual({
      customer: 'sent',
      admin: 'sent',
      error: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      failedRecipient: 'jan@example.com',
      expected: {
        customer: 'failed',
        admin: 'sent',
        error: 'customer_delivery_failed',
      },
    },
    {
      failedRecipient: 'admin@example.com',
      expected: {
        customer: 'sent',
        admin: 'failed',
        error: 'admin_delivery_failed',
      },
    },
  ])(
    'keeps independent statuses when $failedRecipient fails',
    async ({ failedRecipient, expected }) => {
      const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
        const recipient = recipientFromRequest(init);
        return new Response(null, {
          status: recipient === failedRecipient ? 503 : 200,
        });
      });

      await expect(
        sendBookingEmails({
          environment: ENVIRONMENT,
          customerEmail: 'jan@example.com',
          customerContent: CONTENT,
          adminContent: CONTENT,
          fetcher,
        }),
      ).resolves.toEqual(expected);
    },
  );

  it('returns both failed without exposing the Resend response', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response('sensitive provider body', { status: 500 }),
    );

    await expect(
      sendBookingEmails({
        environment: ENVIRONMENT,
        customerEmail: 'jan@example.com',
        customerContent: CONTENT,
        adminContent: CONTENT,
        fetcher,
      }),
    ).resolves.toEqual({
      customer: 'failed',
      admin: 'failed',
      error: 'customer_delivery_failed,admin_delivery_failed',
    });
  });

  it('marks timed-out Resend calls as failed', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    await expect(
      sendBookingEmails({
        environment: ENVIRONMENT,
        customerEmail: 'jan@example.com',
        customerContent: CONTENT,
        adminContent: CONTENT,
        fetcher,
        timeoutMs: 5,
      }),
    ).resolves.toEqual({
      customer: 'failed',
      admin: 'failed',
      error: 'customer_delivery_failed,admin_delivery_failed',
    });
  });

  it('handles missing Resend environment variables without a fetch', async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      sendBookingEmails({
        environment: {},
        customerEmail: 'jan@example.com',
        customerContent: CONTENT,
        adminContent: CONTENT,
        fetcher,
      }),
    ).resolves.toEqual({
      customer: 'failed',
      admin: 'failed',
      error: 'email_configuration_missing',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
