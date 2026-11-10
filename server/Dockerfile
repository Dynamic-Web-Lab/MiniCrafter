# MiniCrafter Rooms relay (Play Together). No dependencies, no storage.
FROM node:22-alpine
WORKDIR /app
COPY rooms.mjs .
USER node
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "rooms.mjs"]
