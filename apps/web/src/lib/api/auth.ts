import 'server-only';

import type { AuthResult, LoginInput, PublicUser, RegisterInput } from '@helpkoro/contracts';

import { apiRequest, type ApiResult } from './client';
import { clearAuthCookies, persistSetCookies } from './cookies';

/**
 * Auth calls for the BFF. login/register set the httpOnly cookies from the API's
 * `Set-Cookie` on the web origin; logout clears them. `getCurrentUser` is a plain
 * read that returns `null` when unauthenticated (so callers can redirect rather
 * than error). All must run from a Server Action / Route Handler except
 * `getCurrentUser`, which only reads cookies and is safe in RSC.
 */

export async function login(input: LoginInput): Promise<ApiResult<AuthResult>> {
  const result = await apiRequest<AuthResult>('/auth/login', { method: 'POST', body: input });
  if (result.setCookies.length) await persistSetCookies(result.setCookies);
  return result;
}

export async function register(input: RegisterInput): Promise<ApiResult<AuthResult>> {
  const result = await apiRequest<AuthResult>('/auth/register', { method: 'POST', body: input });
  if (result.setCookies.length) await persistSetCookies(result.setCookies);
  return result;
}

export async function logout(): Promise<void> {
  const result = await apiRequest<unknown>('/auth/logout', { method: 'POST', body: {} });
  // The API clears its cookies via Set-Cookie; mirror that, then hard-clear as a
  // belt-and-suspenders in case the request never reached the API.
  await persistSetCookies(result.setCookies);
  await clearAuthCookies();
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const result = await apiRequest<PublicUser>('/me');
  return result.ok ? result.data : null;
}
