import { TURNSTILE_TIMEOUT_MS } from './constants';

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileVerificationStatus = 'success' | 'failed' | 'unavailable';

export interface TurnstileVerificationInput {
  secretKey: string | undefined;
  siteKey: string | undefined;
  token: string | undefined;
  remoteIp?: string | undefined;
  fetcher?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

function hasConfiguration(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function isSuccessfulSiteverifyResponse(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'success' in value && value.success === true
  );
}

export async function verifyTurnstile(
  input: TurnstileVerificationInput,
): Promise<TurnstileVerificationStatus> {
  if (!hasConfiguration(input.secretKey) || !hasConfiguration(input.siteKey)) {
    return 'unavailable';
  }

  if (input.token === undefined || input.token.trim().length === 0) {
    return 'failed';
  }

  const body = new URLSearchParams({
    secret: input.secretKey,
    response: input.token,
  });
  const remoteIp = input.remoteIp?.trim();

  if (remoteIp !== undefined && remoteIp.length > 0) {
    body.set('remoteip', remoteIp);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? TURNSTILE_TIMEOUT_MS);

  try {
    const response = await (input.fetcher ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      return 'unavailable';
    }

    const result: unknown = await response.json();

    return isSuccessfulSiteverifyResponse(result) ? 'success' : 'failed';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timeoutId);
  }
}
