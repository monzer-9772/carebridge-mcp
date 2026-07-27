# syntax=docker/dockerfile:1.7
# =============================================================================
# CareBridge MCP server — multi-stage Dockerfile
#   - deps:    npm ci (frozen lockfile)
#   - builder: tsc → dist/
#   - runner:  minimal node 22-alpine with non-root user + tini
# Default transport: stdio (for local MCP clients).
# Set MCP_TRANSPORT=http and MCP_HTTP_PORT to expose the streamable-HTTP
# endpoint (recommended for remote clients).
# =============================================================================

# ---------- 1. deps ----------
FROM node:22.14.0-alpine AS deps
WORKDIR /app
ENV CI=true \
    HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2. builder ----------
FROM node:22.14.0-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc

# ---------- 3. runner ----------
FROM node:22.14.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    MCP_TRANSPORT=stdio \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3100 \
    CAREBRIDGE_BASE_URL=https://carebridge-tfui.onrender.com
RUN apk add --no-cache tini curl \
 && addgroup -g 1001 -S mcp && adduser -S mcp -u 1001
COPY --from=builder --chown=mcp:mcp /app/dist ./dist
COPY --from=builder --chown=mcp:mcp /app/package.json ./package.json
COPY --from=builder --chown=mcp:mcp /app/node_modules ./node_modules
USER mcp
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3100/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
