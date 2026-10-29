# syntax=docker/dockerfile:1

# HMPPS Node.js Runtime Base Image.
# The digest must resolve to the intended Node 24 Alpine image.
# Pinned to tag node:24-alpine3.24 via sha.
FROM ghcr.io/ministryofjustice/devcontainer-base:4.2.1 AS ca

FROM node:24-alpine3.24 AS base

LABEL org.opencontainers.image.title="HMPPS Node.js Runtime Base Image"
LABEL org.opencontainers.image.description="Runtime-only container image for HMPPS Node.js applications with package managers removed"
LABEL org.opencontainers.image.source="https://github.com/ministryofjustice/hmpps-hardened-container-images"
LABEL org.opencontainers.image.vendor="Ministry of Justice"
LABEL org.opencontainers.image.base.name="node:24-alpine3.24"
LABEL hmpps.node.base_image="node"
LABEL hmpps.node.base_variant="24-alpine3.24"

FROM base AS runtime

ARG APP_UID=2000
ARG APP_GID=2000


# not able to pin tzdata version due to frequent updates and removal of old versions, not updating the apk index for tzdata prior to installation to avoid potential conflicts

COPY  --from=ca /usr/local/share/ca-certificates/moj-root.crt /usr/local/share/ca-certificates/moj-root.crt

RUN cp /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt.backup && cat /usr/local/share/ca-certificates/moj-root.crt >> /etc/ssl/certs/ca-certificates.crt
RUN apk add --no-cache tzdata
# renovate: datasource=repology depName=alpine_3_24/ca-certificates versioning=loose
ARG CA_CERTIFICATES_VERSION=20261020-r0

# renovate: datasource=repology depName=alpine_3_24/libstdc++ versioning=loose
ARG LIBSTDCXX_VERSION=15.2.0-r5
RUN apk update --no-cache -qq && apk add --no-cache \
        ca-certificates="${CA_CERTIFICATES_VERSION}" \
        libstdc++="${LIBSTDCXX_VERSION}" && \
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

RUN rm -rf /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
    ln -snf \
        "/usr/share/zoneinfo/${TZ}" \
        /etc/localtime \
    && echo "${TZ}" > /etc/timezone \
    && node --version \
    && test ! -e /usr/local/bin/npm \
    && test ! -e /usr/local/bin/npx \
    && test ! -e /usr/local/bin/corepack

USER appuser
WORKDIR /app

ENTRYPOINT ["node"]
