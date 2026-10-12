# Terramids Tools feature

This branch adds a separate Tool domain, independent from Games, while reusing the established staged ZIP publishing pattern.

## Environment

Add these variables to the backend `.env` in development and production:

```env
TOOL_STORAGE_PATH=/app/storage/tools
TOOL_TEMP_PATH=/app/storage/tool-temp
TOOL_PUBLIC_URL=https://tools.terramids.com
TOOL_MAX_BUILD_SIZE=104857600
TOOL_MAX_EXTRACTED_SIZE=262144000
TOOL_MAX_BUILD_FILES=5000
```

The `CLIENT`, `SERVER`, and `HYBRID` type values are catalog metadata in this foundation; the current runtime serves browser builds as static files. Server-side processing must be implemented through explicit API/worker endpoints for the specific tool rather than executing uploaded server code.

For local development use:

```env
TOOL_PUBLIC_URL=http://tools.localhost:8080
```

The backend config schema requires the variables. Storage directories are mounted separately from game storage. In production, ensure `/srv/terra/storage/tools` and `/srv/terra/storage/tool-temp` are writable by the API container's uid/gid (1000:1000). Add `https://tools.terramids.com` to the comma-separated `CORS_ORIGINS` value in production if browser tools need to call the API. For local development, include `http://tools.localhost:8080` in `CORS_ORIGINS` as well.

## API

Public:
- `GET /api/v1/tools?q=&category=&type=&communityId=`
- `GET /api/v1/tools/:slug`

Admin (JWT + AdminGuard):
- `GET /api/v1/admin/tools`
- `GET /api/v1/admin/tools/:id`
- `POST /api/v1/admin/tools`
- `PATCH /api/v1/admin/tools/:id`
- `PUT /api/v1/admin/tools/:id/communities`
- `DELETE /api/v1/admin/tools/:id` (archives)
- `POST /api/v1/admin/tools/:id/publish`
- `POST /api/v1/admin/tools/:id/unpublish`
- `GET /api/v1/admin/tools/:id/versions`
- `POST /api/v1/admin/tools/:id/versions`
- `PATCH /api/v1/admin/tools/:id/versions/:versionId`
- `POST /api/v1/admin/tools/:id/versions/:versionId/build`
- `POST /api/v1/admin/tools/:id/versions/:versionId/publish`
- `POST /api/v1/admin/tools/:id/versions/:versionId/archive`

Tool ZIP builds must contain `index.html` at the ZIP root. Uploads are staged and only become live when a version is published. Publishing replaces the live directory for that slug, retaining database version history but not old physical builds.

Create local directories if they do not exist:

```bash
mkdir -p storage/tools storage/tool-temp
```

## Migration and deployment

The migration `20261012090000_add_tools_foundation` adds Tool, ToolVersion, ToolCommunity and their enums. After adding the code and `.env` variables:

```bash
npx prisma generate
npx prisma migrate deploy
```

In Docker production, rebuild first so the image includes the generated client and code, then run migration inside the running API container:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

Do not run `migrate deploy` until the API starts successfully with the new required environment variables.
