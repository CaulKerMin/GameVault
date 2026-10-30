FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_FILE=/app/backend/data/leaderboard.json

WORKDIR /app
COPY --chown=node:node backend ./backend
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend
USER node

EXPOSE 3001
CMD ["node", "backend/server.js"]
