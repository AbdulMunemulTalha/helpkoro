import 'server-only';

import { apiRequest, type ApiResult } from './client';
import { persistSetCookies } from './cookies';

/**
 * Proxied *mutation* with silent refresh-on-401. Must be called from a Server
 * Action or Route Handler (it writes cookies). On `AUTH_REQUIRED` it attempts a
 * single `POST /v1/auth/refresh` (the rotating refresh token is forwarded from
 * the httpOnly cookie, CSRF is echoed automatically), persists the rotated
 * cookies, and retries the original call once. Any `Set-Cookie` from the final
 * response is persisted on the way out.
 */
export async function apiMutate<T>(
  path: string,
  init: Parameters<typeof apiRequest>[1],
): Promise<ApiResult<T>> {
  let result = await apiRequest<T>(path, init);

  if (!result.ok && result.error.code === 'AUTH_REQUIRED') {
    const refreshed = await apiRequest<unknown>('/auth/refresh', { method: 'POST', body: {} });
    if (refreshed.setCookies.length) await persistSetCookies(refreshed.setCookies);
    if (refreshed.ok) {
      result = await apiRequest<T>(path, init);
    }
  }

  if (result.setCookies.length) await persistSetCookies(result.setCookies);
  return result;
}
