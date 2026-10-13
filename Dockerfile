# ---------------------------------------------------------------
# AI Hedge Fund - Motia backend (API + workflow + Workbench UI)
# ---------------------------------------------------------------
FROM node:22-bookworm-slim

# Motia keeps state/streams in Redis. Use the distro redis-server binary
# instead of downloading one at install time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends redis-server ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV REDISMS_SYSTEM_BINARY=/usr/bin/redis-server \
    REDISMS_DISABLE_POSTINSTALL=1 \
    MOTIA_TUTORIAL_DISABLED=true \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json types.d.ts ./
COPY services ./services
COPY steps ./steps

EXPOSE 3000

# Set MOTIA_DOCKER_DISABLE_WORKBENCH=true to serve only the API.
CMD ["sh", "-c", "npx motia start --port ${PORT} --host 0.0.0.0"]
