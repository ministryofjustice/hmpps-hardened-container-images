# syntax=docker/dockerfile:1

# HMPPS Node.js Runtime Base Image.
# The digest must resolve to the intended Node 24 Alpine image.
# Pinned to tag 24.19.0-alpine3.24 via sha.
FROM node@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS base

LABEL org.opencontainers.image.title="HMPPS Node.js Runtime Base Image"
LABEL org.opencontainers.image.description="Runtime-only container image for HMPPS Node.js applications with package managers removed"
LABEL org.opencontainers.image.source="https://github.com/ministryofjustice/hmpps-base-container-images"
LABEL org.opencontainers.image.vendor="Ministry of Justice"
LABEL org.opencontainers.image.base.name="alpine:3.24.1"
LABEL hmpps.node.base_image="alpine"
LABEL hmpps.node.base_variant="3.24.1"

FROM base AS runtime

ARG APP_UID=2000
ARG APP_GID=2000

# renovate: datasource=repology depName=alpine_3_24/ca-certificates versioning=loose
ARG CA_CERTIFICATES_VERSION=20260611-r0

# renovate: datasource=repology depName=alpine_3_24/libstdc++
ARG LIBSTDCXX_VERSION=15.2.0-r5

# renovate: datasource=repology depName=alpine_3_24/tzdata versioning=loose
ARG TZDATA_VERSION=2026c-r0

RUN apk update --no-cache -qq && \
    apk upgrade --no-cache && apk add --no-cache \
        ca-certificates="${CA_CERTIFICATES_VERSION}" \
        libstdc++="${LIBSTDCXX_VERSION}" \
        tzdata="${TZDATA_VERSION}" && \
    addgroup \
        --gid "${APP_GID}" \
        --system \
        appgroup \
    && adduser \
        --uid "${APP_UID}" \
        --ingroup appgroup \
        --shell /sbin/nologin \
        --disabled-password \
        --no-create-home \
        --system \
        appuser

ENV NODE_ENV="production"
ENV TZ="Europe/London"

RUN rm -f /usr/local/bin/npm \
    && rm -f /usr/local/bin/npx \
    && rm -f /usr/local/bin/corepack \
    && rm -rf /usr/local/lib/node_modules && \
    ln -snf \
        "/usr/share/zoneinfo/${TZ}" \
        /etc/localtime \
    && echo "${TZ}" > /etc/timezone \
    && node --version \
    && test ! -e /usr/local/bin/npm \
    && test ! -e /usr/local/bin/npx \
    && test ! -e /usr/local/bin/corepack \
    && test ! -d /usr/local/lib/node_modules

USER appuser
WORKDIR /app

ENTRYPOINT ["node"]
CMD ["--version"]
