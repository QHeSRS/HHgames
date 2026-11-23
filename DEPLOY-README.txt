HHgames v1.21.0 - GitHub and Cloudflare Worker deployment files

This package contains an unchanged copy of public/ website assets,
wrangler.toml and the Guandan WebSocket Durable Object relay source
from the original full HHgames v1.21.0 release.

These files belong at the TOP LEVEL of the GitHub repository:
- wrangler.toml
- public/index.html
- public/js/... and other public files
- guandan/worker/src/index.js

Cloudflare deployment:
- Product: Workers (not Pages)
- Connect GitHub repo with Cloudflare Workers Builds
- Worker name: hhgames (matches wrangler.toml)
- Root directory: repository root / (default)
- Production branch: main
- Build command: no command
- Deploy command: npx wrangler deploy
- Test: https://<your-worker-subdomain>.workers.dev/relay
  Expected response: guandan relay ok

Main website: https://<your-worker-subdomain>.workers.dev/
Guandan:      https://<your-worker-subdomain>.workers.dev/guandan/

IMPORTANT: Use the ORIGINAL complete HHgames v1.21.0.zip for future development
(including tests/patch scripts), not this slim upload-only archive.
