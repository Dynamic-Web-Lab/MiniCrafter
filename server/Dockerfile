# MiniCrafter online edition: the Play Together relay and the accounts service share one image.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY rooms.mjs accounts.mjs stats.mjs ./
USER node
CMD ["node", "rooms.mjs"]
