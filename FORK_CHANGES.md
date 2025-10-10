# Fork Changes

This document tracks the changes made to personalize this fork from the original [nuzlocke.app](https://github.com/domtronn/nuzlocke.app) by @domtronn.

## Changes Made

### 1. Dependency Updates and Cleanup

- **Removed Sentry**: Uninstalled `@sentry/svelte` as it's not needed for this fork
- **Fixed pokemon-assets**: Updated from non-existent version `0.6.0` to `1.0.5`
- **Pinned SvelteKit versions**: 
  - `@sveltejs/kit`: Changed from `"next"` to `1.0.0-next.570`
  - `@sveltejs/adapter-vercel`: Changed from `"next"` to `1.0.0-next.84`
  - This prevents automatic updates that could break compatibility with Vite 3.2.x

**Security Note**: 10 vulnerabilities remain (1 low, 4 moderate, 5 high). These require breaking changes to fix and will be addressed in a future major update.

### 2. Removed Author-Specific References

- **Buy Me a Coffee links**: Removed all donation links and support banners
  - `src/lib/components/navs/SupportBanner.svelte`: Disabled entire support banner component
  - `src/lib/components/navs/Footer.svelte`: Removed Coffee button, kept only GitHub issues link
  
### 3. Updated Repository Information

- **package.json**: Updated repository, author, and license information
  - Repository: `https://github.com/Macroblond44/nuzlocke.app`
  - Author: `Macroblond44 <yeray.martin@adscanpro.com>`
  - License: BSD-3-Clause (maintained from original)

### 4. Removed Third-Party Tracking Services

- **Google Analytics**: Removed Google Tag Manager tracking code from `src/app.html`
- **Google Site Verification**: Removed verification meta tag
- **Sentry**: Removed references from CSP headers in `vercel.json`

### 5. Updated Documentation

- **README.md**: 
  - Removed Buy Me a Coffee badge
  - Added fork attribution to original author
  - Added local development setup instructions
  - Cleaned up useful links section

### 6. Updated Footer

- **Footer Component**: 
  - Now shows "Fork by Macroblond44" with credit to original author Domtronn
  - Updated GitHub issues link to point to forked repository
  - Removed Discord and Coffee support links

### 7. Security Headers

- **vercel.json**: Updated Content-Security-Policy to remove:
  - `*.ingest.sentry.io`
  - `*.googletagmanager.com`
  - `*.google-analytics.com`

## Local Development

To run this project locally:

```bash
# Install dependencies
yarn install

# Run development server
yarn dev
```

The application will be available at `http://localhost:5173`

## Future Deployment

The `vercel.json` configuration is maintained for potential future deployment to Vercel, but with cleaned security headers and without third-party tracking services.

## Original Author Credit

Original project by **Domtronn** (Diego Ballesteros)
- GitHub: https://github.com/domtronn/nuzlocke.app
- Live site: https://nuzlocke.app

All credits for the original design, architecture, and core functionality go to the original author.

