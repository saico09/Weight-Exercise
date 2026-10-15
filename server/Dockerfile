FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
USER node
ENV NODE_ENV=production
CMD ["node", "--max-old-space-size=96", "src/index.mjs"]
