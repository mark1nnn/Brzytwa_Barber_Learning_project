import { RESEND_TIMEOUT_MS } from './constants';
import type { EmailContent } from './email-templates';
import type { EmailDeliveryStatus } from './types';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendEnvironment {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  ADMIN_NOTIFICATION_EMAIL?: string;
}

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  adminEmail: string;
}

export interface BookingEmailDeliveryInput {
  environment: ResendEnvironment;
  customerEmail: string;
  customerContent: EmailContent;
  adminContent: EmailContent;
  fetcher?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

export interface BookingEmailDeliveryResult {
  customer: EmailDeliveryStatus;
  admin: EmailDeliveryStatus;
  error: string | null;
}

function nonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

export function getResendConfig(environment: ResendEnvironment): ResendConfig | null {
  if (
    !nonEmpty(environment.RESEND_API_KEY) ||
    !nonEmpty(environment.RESEND_FROM_EMAIL) ||
    !nonEmpty(environment.ADMIN_NOTIFICATION_EMAIL)
  ) {
    return null;
  }

  return {
    apiKey: environment.RESEND_API_KEY,
    fromEmail: environment.RESEND_FROM_EMAIL,
    adminEmail: environment.ADMIN_NOTIFICATION_EMAIL,
  };
}

async function sendResendEmail(
  config: ResendConfig,
  to: string,
  content: EmailContent,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<EmailDeliveryStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: controller.signal,
    });

    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendBookingEmails(
  input: BookingEmailDeliveryInput,
): Promise<BookingEmailDeliveryResult> {
  const config = getResendConfig(input.environment);

  if (config === null) {
    return {
      customer: 'failed',
      admin: 'failed',
      error: 'email_configuration_missing',
    };
  }

  const fetcher = input.fetcher ?? fetch;
  const timeoutMs = input.timeoutMs ?? RESEND_TIMEOUT_MS;
  const [customer, admin] = await Promise.all([
    sendResendEmail(config, input.customerEmail, input.customerContent, fetcher, timeoutMs),
    sendResendEmail(config, config.adminEmail, input.adminContent, fetcher, timeoutMs),
  ]);
  const failures = [
    ...(customer === 'failed' ? ['customer_delivery_failed'] : []),
    ...(admin === 'failed' ? ['admin_delivery_failed'] : []),
  ];

  return {
    customer,
    admin,
    error: failures.length === 0 ? null : failures.join(','),
  };
}
