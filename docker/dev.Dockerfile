# Development image: Node and pnpm, nothing else. The source is mounted from
# the host; node_modules and the pnpm store live in Docker volumes, so the
# host needs only Docker.
FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm \
    npm_config_store_dir=/pnpm/store \
    NEXT_TELEMETRY_DISABLED=1
ENV PATH=$PNPM_HOME:$PATH

# git: some tools read the repo state; ca-certificates for registry access.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && mkdir -p /app/node_modules /app/dev/.next /pnpm/store \
 && chown -R node:node /app /pnpm

USER node
WORKDIR /app

# Fetch the pnpm version from package.json's "packageManager" once, at build time.
COPY --chown=node:node package.json ./
RUN corepack install

EXPOSE 3000
CMD ["pnpm", "dev"]
