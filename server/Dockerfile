FROM node:24-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/scripts/revoke-pro.mjs ./scripts/revoke-pro.mjs
COPY --chown=node:node shared /app/shared
USER node
ENV NODE_ENV=production
CMD ["node", "--max-old-space-size=96", "src/index.mjs"]
