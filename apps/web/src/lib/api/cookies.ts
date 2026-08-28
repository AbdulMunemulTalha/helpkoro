import 'server-only';

import { cookies } from 'next/headers';

/** Auth cookies the API issues (ADR-007). Names mirror the API constants. */
const AUTH_COOKIES = ['hk_at', 'hk_rt', 'hk_csrf'] as const;

type SameSite = boolean | 'lax' | 'strict' | 'none';

interface ParsedSetCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSite;
  maxAge?: number;
  /** True when the API is *clearing* the cookie (empty value or non-positive max-age). */
  deleted: boolean;
}

function parseSetCookie(raw: string): ParsedSetCookie | null {
  const segments = raw.split(';').map((s) => s.trim());
  const [pair, ...attributes] = segments;
  if (!pair) return null;
  const eq = pair.indexOf('=');
  if (eq < 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return null;

  const attrs = new Map<string, string>();
  for (const attr of attributes) {
    const idx = attr.indexOf('=');
    if (idx < 0) attrs.set(attr.toLowerCase(), '');
    else attrs.set(attr.slice(0, idx).trim().toLowerCase(), attr.slice(idx + 1).trim());
  }

  const rawSameSite = attrs.get('samesite')?.toLowerCase();
  const sameSite: SameSite =
    rawSameSite === 'strict' || rawSameSite === 'none' || rawSameSite === 'lax'
      ? rawSameSite
      : 'lax';
  const maxAgeRaw = attrs.get('max-age');
  const maxAge = maxAgeRaw !== undefined ? Number.parseInt(maxAgeRaw, 10) : undefined;

  return {
    name,
    value,
    httpOnly: attrs.has('httponly'),
    secure: attrs.has('secure'),
    sameSite,
    maxAge: Number.isNaN(maxAge) ? undefined : maxAge,
    deleted: value === '' || (maxAge !== undefined && maxAge <= 0),
  };
}

/**
 * Re-emit the API's `Set-Cookie` headers on the *web* origin so the browser
 * returns them to the BFF on subsequent requests. Path is deliberately forced to
 * `/`: the API scopes `hk_rt` to `/v1/auth`, which does not exist on the web
 * origin, so keeping that path would stop the browser from ever sending the
 * refresh token back. The token stays httpOnly + SameSite=Lax and is only ever
 * forwarded server-side to the API's refresh endpoint — never exposed to client
 * JS or other origins (see ADR-009). Must be called from a Server Action or
 * Route Handler (cookie writes throw during RSC render).
 */
export async function persistSetCookies(setCookies: string[]): Promise<void> {
  if (setCookies.length === 0) return;
  const store = await cookies();
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw);
    if (!parsed) continue;
    if (parsed.deleted) {
      store.delete(parsed.name);
      continue;
    }
    store.set(parsed.name, parsed.value, {
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
      path: '/',
      maxAge: parsed.maxAge,
    });
  }
}

/** Delete every auth cookie on the web origin (defensive clear on logout). */
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const name of AUTH_COOKIES) store.delete(name);
}
