# One image for the app: dependencies and source. The Next.js build runs when
# the container first starts (docker/entrypoint.sh), with the runtime settings.
FROM node:24-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
# openssl: the Prisma command line looks for it when applying migrations.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app
RUN chown node:node /app
USER node

# Dependencies first, so they are cached while only the source changes.
# The install also generates the database client (postinstall), which needs
# the schema; NODE_ENV is left unset here so development tools are installed.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml database.config.ts ./
COPY --chown=node:node prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .

EXPOSE 3000
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
