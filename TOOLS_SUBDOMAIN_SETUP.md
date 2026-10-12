# Tools subdomain hosting setup

This change prepares static hosting for `tools.terramids.com`, parallel to the existing
`games.terramids.com` host. It does **not** implement the Tool catalog, Tool/ToolVersion
database models, admin upload/publish endpoints, or the frontend `/tools/[slug]` shell;
those should be added as the Tools feature implementation.

## Production

Create the host directories on the VPS:

```bash
sudo mkdir -p /srv/terra/storage/tools
sudo mkdir -p /srv/terra/storage/tool-temp
sudo chown -R 1000:1000 /srv/terra/storage/tools /srv/terra/storage/tool-temp
```

Add a DNS `A` record for `tools.terramids.com` pointing to the VPS IP. Caddy will obtain
and renew TLS certificates automatically when DNS resolves correctly and ports 80/443
are reachable.

Ensure the API's `CORS_ORIGINS` includes the tool origin if browser-based tools will call
the API directly:

```env
CORS_ORIGINS=https://www.terramids.com,https://games.terramids.com,https://tools.terramids.com
```

Then deploy the configuration:

```bash
cd /srv/terra/app
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs --tail=100 caddy
```

The Caddy container serves published static files read-only from
`/srv/terra/storage/tools`, while the API container has read/write mounts for
`/app/storage/tools` and `/app/storage/tool-temp`.

## Local development

Create local directories:

```bash
mkdir -p storage/tools storage/tool-temp
```

Restart the dev stack after pulling these changes:

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d --build
```

A file at `storage/tools/example/index.html` should be reachable at
`http://tools.localhost:8080/example/`.

## Important security note

Tools run on a separate origin from the main Terramids app. Keep it separate from
`www.terramids.com`; do not configure a broad cookie domain such as `.terramids.com`
for tool-session credentials. Any future tool iframe integration should use a narrowly
scoped, short-lived token and a strict `postMessage` origin check, following the game
integration pattern without sharing game-specific domain models.
