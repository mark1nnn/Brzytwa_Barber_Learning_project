import { MAX_JSON_BODY_BYTES } from './constants';
import { ApiError } from './errors';
import { API_ERROR_CODES } from './types';

const JSON_MEDIA_TYPE_PATTERN = /^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)$/i;

function payloadTooLargeError(): ApiError {
  return new ApiError({
    code: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
    status: 413,
    message: 'Treść żądania jest zbyt duża.',
  });
}

export function assertMethod(request: Request, allowedMethods: readonly string[]): void {
  const normalizedMethods = allowedMethods.map((method) => method.toUpperCase());

  if (normalizedMethods.includes(request.method.toUpperCase())) {
    return;
  }

  throw new ApiError({
    code: API_ERROR_CODES.METHOD_NOT_ALLOWED,
    status: 405,
    message: 'Ta metoda HTTP nie jest obsługiwana.',
    headers: {
      Allow: normalizedMethods.join(', '),
    },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('Content-Type');
  const mediaType = contentType?.split(';', 1)[0]?.trim();

  if (mediaType === undefined || !JSON_MEDIA_TYPE_PATTERN.test(mediaType)) {
    throw new ApiError({
      code: API_ERROR_CODES.INVALID_CONTENT_TYPE,
      status: 415,
      message: 'Wymagany jest format application/json.',
    });
  }

  const contentLength = request.headers.get('Content-Length');

  if (contentLength !== null && /^\d+$/.test(contentLength.trim())) {
    const declaredBytes = Number(contentLength);

    if (Number.isSafeInteger(declaredBytes) && declaredBytes > MAX_JSON_BODY_BYTES) {
      throw payloadTooLargeError();
    }
  }

  const rawBody = await request.text();
  const actualBytes = new TextEncoder().encode(rawBody).byteLength;

  if (actualBytes > MAX_JSON_BODY_BYTES) {
    throw payloadTooLargeError();
  }

  if (rawBody.trim().length === 0) {
    throw new ApiError({
      code: API_ERROR_CODES.INVALID_JSON,
      status: 400,
      message: 'Nie udało się odczytać danych JSON.',
    });
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);
    return parsed;
  } catch (cause) {
    throw new ApiError({
      code: API_ERROR_CODES.INVALID_JSON,
      status: 400,
      message: 'Nie udało się odczytać danych JSON.',
      cause,
    });
  }
}
