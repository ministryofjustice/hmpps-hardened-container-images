# HMPPS Node.js Runtime Base Image (Distroless)
FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS prep

ARG APP_UID=2000
ARG APP_GID=2000

RUN groupadd --gid ${APP_GID} appgroup && \
    useradd --uid ${APP_UID} --gid ${APP_GID} --create-home appuser
RUN install -d -o appuser -g appgroup /home/appuser/.postgresql
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /home/appuser/.postgresql/root.crt
RUN chown appuser:appgroup /home/appuser/.postgresql/root.crt && \
    chmod 0644 /home/appuser/.postgresql/root.crt

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:22d2f0480e59548ad14cf10d8921b24ef809780e7a61b162838f3d15a4a92e3d AS runtime

ARG APP_UID=2000
ARG APP_GID=2000

LABEL org.opencontainers.image.title="HMPPS Node.js Runtime Base Image (Distroless)"
LABEL org.opencontainers.image.description="Distroless runtime image for Node.js applications in HMPPS"
LABEL org.opencontainers.image.source="https://github.com/ministryofjustice/hmpps-hardened-container-images"
LABEL org.opencontainers.image.vendor="Ministry of Justice"
LABEL hmpps.node.base_variant="distroless"
LABEL org.opencontainers.image.base.name="gcr.io/distroless/nodejs22-debian13:nonroot"

WORKDIR /app

ENV TZ="Europe/London"
ENV NODE_ENV="production"

COPY --from=prep --chown=${APP_UID}:${APP_GID} /home/appuser/.postgresql/root.crt /home/appuser/.postgresql/root.crt

USER ${APP_UID}:${APP_GID}
