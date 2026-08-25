import 'server-only';
import { z } from 'zod';
import { baseEnvSchema, parseEnv } from '@helpkoro/contracts';

/**
 * Web (BFF) environment.
 *
 * `API_URL` is the *server-side* base URL of the HelpKoro API. Because the API
 * enables no CORS and sets httpOnly cookies, the browser cannot call it directly;
 * `apps/web` proxies every request server-to-server (RSC reads, server actions,
 * route handlers). This value is therefore read only in server code and is never
 * exposed to the client bundle — the `server-only` import above turns an accidental
 * client import into a build error.
 */
const webEnvSchema = baseEnvSchema.extend({
  API_URL: z
    .string()
    .refine((v) => URL.canParse(v), { message: 'must be a valid URL' })
    .default('http://localhost:3001'),
});

export const env = parseEnv(webEnvSchema, process.env);
export type WebEnv = z.infer<typeof webEnvSchema>;
