# HMPPS Java Base Image

Standardized base image for JVM applications in HMPPS. Provides a consistent, lean, non‑root runtime across Ubuntu (Jammy) and distroless variants.

## Supported Variants

| Image | Variant Tag | OS | Arch (multi-platform) | Notes |
|-------|-------------|----|-----------------------|-------|
| java-temurin | 21-docker-main | Ubuntu | amd64, arm64 | LTS line (Java 21) |
| java-temurin | 25-docker-main | Ubuntu | amd64, arm64 | Current default line |
| java-distroless | 21-docker-main | Distroless | amd64, arm64 | Minimal runtime footprint (no shell/package manager) |
| java-distroless | 25-docker-main | Distroless | amd64, arm64 | Minimal runtime footprint (no shell/package manager) |

## Distroless Variant

The distroless variants use Google's minimal distroless base images instead of full OS distributions, reducing attack surface and image size.

**Notes:**

- No shell/package manager in runtime image (debugging harder).
- Two-stage build: prepare assets in Debian (full OS), run on distroless.
- Requires explicit binary/library copies; fewer implicit dependencies.

Images are published to:

```
ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin
ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-distroless
```

Tags applied (via GitHub Actions metadata):

| Tag Type | Example | Purpose |
|----------|---------|---------|
| Branch / PR | 25-docker-feature-update | Flavour plus sanitized source ref |
| Release | 25-docker-v1.2.3 | Versioned flavour |

Only grouped paths are published; old names are no longer updated. There are no
`latest`, bare variant, date or SHA aliases. Pin release tags and digests for production.

## JVM Defaults Explained

| Option | Effect | Rationale |
|--------|--------|-----------|
| `-XX:+ExitOnOutOfMemoryError` | JVM exits immediately on OOM | Fast restart; avoids wedged process |
| `-XX:MaxRAMPercentage=50.0` | Heap sized to 50% of container limit | Leaves headroom for metaspace/native |

Override by supplying `JAVA_TOOL_OPTIONS` or explicit `-Xmx` in your application image.

The 50% has been judged based off a maximum pod memory limit of 1Gi. If you have set your pod maximum to a greater value
then you could up the percentage to a higher figure without running foul of the linux Out Of Memory Killer.

## RDS Root Certificate

AWS RDS global bundle is placed at:

```
/home/appuser/.postgresql/root.crt
```

This enables Postgres clients (libpq, JDBC when referencing libpq conventions) to verify SSL without app modification.

## Timezone Handling

We set `TZ=Europe/London` and symlink `/etc/localtime` to zoneinfo. Remove or change by overriding `TZ` and replacing the symlink in a downstream layer.

## Extending the Base (Example: Gradle Multi-Stage)

```dockerfile
FROM --platform=$BUILDPLATFORM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /src
COPY . .
RUN ./gradlew --no-daemon assemble

FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:21-docker-main
WORKDIR /app
COPY --from=build /src/build/libs/app.jar ./app.jar
USER 2000
CMD ["java", "-jar", "app.jar"]
```

## CI Build Behavior

CI builds multi-arch images (linux/amd64, linux/arm64) on push, PR, manual dispatch, and weekdays at 05:00 UTC.
