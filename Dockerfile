# One image for the app: dependencies and source. The Next.js build runs when
# the container first starts (docker/entrypoint.sh), because it needs the
# database and the runtime settings.
FROM node:24-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

WORKDIR /app

# Dependencies first, so they are cached while only the source changes.
# The install also generates the database client (postinstall), which needs
# the schema; NODE_ENV is left unset here so development tools are installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml database.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN chmod +x docker/entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 3000
ENTRYPOINT ["docker/entrypoint.sh"]
