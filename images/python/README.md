# Python Base Image

Lean, standardized Python base image for HMPPS apps.

## Supported Variants

| Image | Variant Tag | OS | Arch (multi-platform) | Notes |
|-------|-------------|----|-----------------------|-------|
| python-alpine | 3.13-docker-main | Alpine | amd64, arm64 | Lightweight runtime with uv preinstalled |


## Features

- Non‑root user `appuser` (UID/GID 2000) and `WORKDIR /app`
- Timezone: `Europe/London`
- Security upgrades stage (`apk upgrade --no-cache`)
- OCI labels: `hmpps.python.base_image`, `hmpps.python.base_variant`, `org.opencontainers.image.base.name`

Registry: `ghcr.io/ministryofjustice/hmpps-hardened-container-images/python-alpine`

Tags combine flavour and source ref, for example `3.13-docker-main` or
`3.13-docker-v1.2.3`. Old package names are no longer updated; there are no
`latest`, bare variant, date or SHA aliases.

## Usage (simple)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/python-alpine:3.13-docker-main
WORKDIR /app

COPY --chown=appuser:appgroup . .
USER 2000
CMD ["python", "-m", "your_app"]
```

## Notes

- Add dependencies in `pyproject.toml` and run `uv sync` during your build stage.

## Usage (multi-stage)

```dockerfile
# Base (provides non-root user, TZ Europe/London, security upgrades)
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/python-alpine:3.13-docker-main AS base

# Optional build metadata
ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH
ENV BUILD_NUMBER=${BUILD_NUMBER} \
	GIT_REF=${GIT_REF} \
	GIT_BRANCH=${GIT_BRANCH}

WORKDIR /app

# Initialize dependencies
COPY pyproject.toml .
RUN uv sync

COPY --chown=appuser:appgroup classes classes
COPY --chown=appuser:appgroup processes processes
COPY --chown=appuser:appgroup sharepoint_discovery.py /app/sharepoint_discovery.py

USER 2000

CMD [ "uv", "run", "python", "-u", "/app/sharepoint_discovery.py" ]
```
