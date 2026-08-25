import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Point the plugin at the request-scoped i18n config (locale + messages per request).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared workspace packages ship TS/TSX source; Next must transpile them.
  transpilePackages: ['@helpkoro/ui', '@helpkoro/contracts'],
  // No client source maps: keep the bundle lean for low-bandwidth users and avoid
  // leaking server-side reasoning into the browser.
  productionBrowserSourceMaps: false,
};

export default withNextIntl(nextConfig);
