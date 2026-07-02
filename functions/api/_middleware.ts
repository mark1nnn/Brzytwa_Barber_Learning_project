import {
  API_RESPONSE_HEADERS,
  jsonError,
} from "../_shared/api-response";
import {
  isApiError,
} from "../_shared/errors";
import {
  API_ERROR_CODES,
} from "../_shared/types";

interface ApiLogger {
  error(message: string, details: Record<string, unknown>): void;
}

interface ApiMiddlewareInput {
  request: Request;
  next: () => Promise<Response>;
  logger?: ApiLogger;
}

const defaultLogger: ApiLogger = {
  error(message, details) {
    console.error(message, details);
  },
};

function getServerErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: "Non-Error value thrown.",
  };
}

function addApiHeaders(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(API_RESPONSE_HEADERS)) {
    if (name !== "Content-Type") {
      headers.set(name, value);
    }
  }

  headers.set("X-Request-Id", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleApiRequest(
  input: ApiMiddlewareInput,
): Promise<Response> {
  const logger = input.logger ?? defaultLogger;
  const cfRay = input.request.headers.get("CF-Ray")?.trim();
  const requestId =
    cfRay === undefined || cfRay.length === 0
      ? crypto.randomUUID()
      : cfRay;
  const pathname = new URL(input.request.url).pathname;

  try {
    return addApiHeaders(await input.next(), requestId);
  } catch (error) {
    if (isApiError(error)) {
      if (error.cause !== undefined) {
        logger.error("API request failed", {
          requestId,
          cfRay,
          method: input.request.method,
          pathname,
          code: error.code,
          ...getServerErrorDetails(error.cause),
        });
      }

      return addApiHeaders(
        jsonError(
          {
            code: error.code,
            message: error.message,
            ...(error.fieldErrors === undefined
              ? {}
              : { fieldErrors: error.fieldErrors }),
          },
          {
            status: error.status,
            headers: error.headers,
          },
        ),
        requestId,
      );
    }

    logger.error("Unhandled API error", {
      requestId,
      cfRay,
      method: input.request.method,
      pathname,
      ...getServerErrorDetails(error),
    });

    return addApiHeaders(
      jsonError(
        {
          code: API_ERROR_CODES.INTERNAL_ERROR,
          message:
            "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.",
        },
        {
          status: 500,
        },
      ),
      requestId,
    );
  }
}

export const onRequest: PagesFunction<Env> = (context) =>
  handleApiRequest({
    request: context.request,
    next: () => context.next(),
  });
