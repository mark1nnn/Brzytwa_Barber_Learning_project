import { ApiError } from '../../_shared/errors';
import { API_ERROR_CODES } from '../../_shared/types';

const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';
const ACCESS_IDENTITY_HEADER = 'Cf-Access-Authenticated-User-Email';

function hasHeaderValue(request: Request, name: string): boolean {
  const value = request.headers.get(name);
  return value !== null && value.trim().length > 0;
}

export function assertAdminAccess(request: Request): void {
  if (
    !hasHeaderValue(request, ACCESS_JWT_HEADER) ||
    !hasHeaderValue(request, ACCESS_IDENTITY_HEADER)
  ) {
    throw new ApiError({
      code: API_ERROR_CODES.ADMIN_UNAUTHORIZED,
      status: 401,
      message: 'Wymagane jest uwierzytelnienie przez Cloudflare Access.',
    });
  }
}

export async function handleAdminAccessRequest(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  assertAdminAccess(request);
  return next();
}

export const onRequest: PagesFunction<Env> = (context) =>
  handleAdminAccessRequest(context.request, () => context.next());
