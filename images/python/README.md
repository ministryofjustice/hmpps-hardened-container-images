# Python Base Image

Lean, standardized Python base image for HMPPS apps.

## Supported Variants

| Image | Variant Tag | OS | Arch (multi-platform) | Notes |
|-------|-------------|----|-----------------------|-------|
| hmpps-python | python3.13-alpine | Alpine | amd64, arm64 | Lightweight runtime with uv preinstalled |


## Features

- Non‑root user `appuser` (UID/GID 2000) and `WORKDIR /app`
- Timezone: `Europe/London`
- Security upgrades stage (`apk upgrade --no-cache`)
- OCI labels: `hmpps.python.base_image`, `hmpps.python.base_variant`, `org.opencontainers.image.base.name`

Registry: `ghcr.io/ministryofjustice/hmpps-python`

Common tags: `python3.13-alpine`, date tags (YYYYMMDD), `latest`

Current latest mapping in CI:

- `ghcr.io/ministryofjustice/hmpps-python:latest` -> `python3.13-alpine`

## Usage (simple)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-python:python3.13-alpine
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
FROM ghcr.io/ministryofjustice/hmpps-python:python3.13-alpine AS base

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
