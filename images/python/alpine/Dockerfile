# HMPPS Python Base Image
FROM ghcr.io/astral-sh/uv:python3.13-alpine AS base

# Metadata
LABEL org.opencontainers.image.title="HMPPS Python Base Image"
LABEL org.opencontainers.image.description="Base container image for Python applications used within HMPPS"
LABEL org.opencontainers.image.source="https://github.com/ministryofjustice/hmpps-base-container-images"
LABEL org.opencontainers.image.vendor="Ministry of Justice"
LABEL hmpps.python.base_variant="python3.13-alpine"
LABEL hmpps.python.base_image="ghcr.io/astral-sh/uv"
LABEL org.opencontainers.image.base.name="ghcr.io/astral-sh/uv:python3.13-alpine"

WORKDIR /app
ARG APP_UID=2000
ARG APP_GID=2000
RUN addgroup -g ${APP_GID} -S appgroup && \
    adduser -u ${APP_UID} -S appuser -G appgroup
RUN chown -R 2000:2000 /app

# Security upgrades in separate stage for cache control
# Build with: docker buildx build --no-cache-filter=security-upgrades ...
FROM base AS security-upgrades
RUN apk upgrade --no-cache

# update PATH environment variable
ENV PATH=/home/appuser/.local:/app:$PATH

USER 2000
