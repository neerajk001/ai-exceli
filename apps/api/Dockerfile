FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global pnpm@11.25.0

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN DIRECT_URL=postgresql://build:build@localhost:5432/build \
  DATABASE_URL=postgresql://build:build@localhost:5432/build \
  pnpm --filter @wb/api build

RUN chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "pnpm --filter @wb/api exec prisma migrate deploy && exec pnpm --filter @wb/api exec tsx src/server.ts"]
