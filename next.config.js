const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'http2.mlstatic.com' },
      { protocol: 'https', hostname: '*.mercadolibre.com' }
    ]
  }
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  // Sourcemaps would require SENTRY_AUTH_TOKEN; skipping until needed.
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false
})
