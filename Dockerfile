# kaiban-distributed-examples — single image, role chosen per compose `command`.
#
#   gateway       → node node_modules/kaiban-distributed/dist/src/main/index.js
#   worker node   → node dist/<example>/<role>-node.js
#   orchestrator  → node dist/<example>/orchestrator.js
#
# Stage 1: build our TypeScript examples.
FROM node:22.14-alpine AS builder
WORKDIR /app
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY resume-creation/ ./resume-creation/
COPY trip-planning/ ./trip-planning/
COPY social-media-team/ ./social-media-team/
COPY rag-knowledge-base/ ./rag-knowledge-base/
RUN npm run build

# Stage 2: prod runtime.
FROM node:22.14-alpine AS runner
WORKDIR /app
RUN apk upgrade --no-cache
RUN addgroup -S kaiban && adduser -S kaiban -G kaiban
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# kaiban-distributed (the gateway/runtime) is a prod dependency, so its built
# dist/ is present under node_modules and can be launched directly for the gateway.
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/resume-creation/runs /app/trip-planning/runs /app/social-media-team/runs /app/rag-knowledge-base/runs \
  && chown -R kaiban:kaiban /app/resume-creation /app/trip-planning /app/social-media-team /app/rag-knowledge-base
USER kaiban
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}
# Default command runs the gateway; compose overrides `command` for workers/orchestrator.
CMD ["node", "node_modules/kaiban-distributed/dist/src/main/index.js"]
