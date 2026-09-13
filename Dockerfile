# Single-stage: this app has no compile step — the frontend is plain
# HTML/CSS/JS served straight from public/, and the backend is Node with
# SQLite built into the runtime (node:sqlite), so there are no native
# modules to build and nothing to bundle.
FROM node:24-alpine

WORKDIR /app

# Dependencies first, so a code-only change doesn't re-run npm ci.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public

# The SQLite database and the JWT signing secret live here; mounted as a
# volume in docker-compose.yml so they survive image rebuilds.
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run as the image's built-in non-root user.
RUN chown -R node:node /app
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/settings').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
