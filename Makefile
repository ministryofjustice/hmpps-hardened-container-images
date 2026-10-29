TIMESTAMP := $(shell date -u  +"%Y-%m-%dT%H:%M:%SZ")
.DEFAULT_GOAL := apko
TAG_TIMESTAMP := $(shell date +%H%M%S )
IMAGE := hmpps-node-runtime:local
ARCH ?= $(shell uname -m | sed 's/x86_64/amd64/')
SCANNER_BUILD_DIR ?= /tmp/hmpps-scanners
SCANNER_CA_CERTIFICATE ?=
NODE_MAJOR ?= 24
NPM_MAJOR ?= 12
FLAVOUR ?= build
NODE_FLAVOUR_BUILD_DIR ?= /tmp/hmpps-node-flavours
NODE_FLAVOUR_IMAGE ?= hmpps-node-$(NODE_MAJOR)-$(FLAVOUR)$(if $(filter build,$(FLAVOUR)),-npm$(NPM_MAJOR)):local

.PHONY: node-flavour
node-flavour:
	@case "$(NODE_MAJOR):$(FLAVOUR):$(NPM_MAJOR)" in \
		24:build:11|24:build:12|26:build:12|24:runtime:*|26:runtime:*) ;; \
		*) echo "Supported: Node 24/npm 11, Node 24/npm 12, Node 26/npm 12, or runtime on 24/26" >&2; exit 1 ;; \
	esac
	mkdir -p "$(NODE_FLAVOUR_BUILD_DIR)/source" "$(NODE_FLAVOUR_BUILD_DIR)/packages" "$(NODE_FLAVOUR_BUILD_DIR)/output" "$(SCANNER_BUILD_DIR)/keys" "$(SCANNER_BUILD_DIR)/cache" "$(SCANNER_BUILD_DIR)/apk-cache"
	ruby scripts/render-node-apko.rb "$(NODE_MAJOR)" "$(FLAVOUR)" "$(NODE_FLAVOUR_BUILD_DIR)/output/apko.yaml"
	@set -e; \
	if [ "$(FLAVOUR)" = build ]; then \
		test -f "$(SCANNER_BUILD_DIR)/keys/melange.rsa" || melange keygen "$(SCANNER_BUILD_DIR)/keys/melange.rsa"; \
		MELANGE_EXTRA_CA_CERTS="$(SCANNER_CA_CERTIFICATE)" bash scripts/quiet-build.sh "$(NODE_FLAVOUR_BUILD_DIR)/output/melange.log" melange build \
			--runner docker --arch "$(ARCH)" \
			--cache-dir "$(SCANNER_BUILD_DIR)/cache" \
			--apk-cache-dir "$(SCANNER_BUILD_DIR)/apk-cache" \
			--source-dir "$(NODE_FLAVOUR_BUILD_DIR)/source" \
			--signing-key "$(SCANNER_BUILD_DIR)/keys/melange.rsa" \
			--out-dir "$(NODE_FLAVOUR_BUILD_DIR)/packages" \
			"images/node/alpine/melange.npm$(NPM_MAJOR).yaml"; \
		case "$(NPM_MAJOR)" in 11) version=11.12.1 ;; 12) version=12.2.0 ;; esac; \
		set -- --build-repository-append "$(NODE_FLAVOUR_BUILD_DIR)/packages" \
			--keyring-append "$(SCANNER_BUILD_DIR)/keys/melange.rsa.pub" \
			--package-append "hmpps-npm$(NPM_MAJOR)=$$version-r0"; \
	else set --; fi; \
	bash scripts/quiet-build.sh "$(NODE_FLAVOUR_BUILD_DIR)/output/apko.log" apko build --arch "$(ARCH)" --build-date "$(TIMESTAMP)" \
		--sbom-path "$(NODE_FLAVOUR_BUILD_DIR)/output" "$$@" \
		"$(NODE_FLAVOUR_BUILD_DIR)/output/apko.yaml" \
		"$(NODE_FLAVOUR_IMAGE)" "$(NODE_FLAVOUR_BUILD_DIR)/output/image.tar"; \
	docker load --input "$(NODE_FLAVOUR_BUILD_DIR)/output/image.tar"

.PHONY: scanners
scanners:
	mkdir -p "$(SCANNER_BUILD_DIR)/keys" "$(SCANNER_BUILD_DIR)/source" "$(SCANNER_BUILD_DIR)/cache" "$(SCANNER_BUILD_DIR)/apk-cache" "$(SCANNER_BUILD_DIR)/packages" "$(SCANNER_BUILD_DIR)/output"
	@test -f "$(SCANNER_BUILD_DIR)/keys/melange.rsa" || melange keygen "$(SCANNER_BUILD_DIR)/keys/melange.rsa"
	MELANGE_EXTRA_CA_CERTS="$(SCANNER_CA_CERTIFICATE)" bash scripts/quiet-build.sh "$(SCANNER_BUILD_DIR)/output/melange.log" melange build \
		--runner docker --arch "$(ARCH)" \
		--cache-dir "$(SCANNER_BUILD_DIR)/cache" \
  		--ca-certificate-append /tmp/hmpps-scanners/moj-root.crt \
		--apk-cache-dir "$(SCANNER_BUILD_DIR)/apk-cache" \
		--source-dir "$(SCANNER_BUILD_DIR)/source" \
		--signing-key "$(SCANNER_BUILD_DIR)/keys/melange.rsa" \
		--out-dir "$(SCANNER_BUILD_DIR)/packages" \
		images/node/alpine-runtime/melange.scanners.yaml && \
	bash scripts/quiet-build.sh "$(SCANNER_BUILD_DIR)/output/apko.log" apko build --build-date "$(TIMESTAMP)" --arch "$(ARCH)" \
		--build-repository-append "$(SCANNER_BUILD_DIR)/packages" \
		--keyring-append "$(SCANNER_BUILD_DIR)/keys/melange.rsa.pub" \
		--package-append hmpps-node-scanners=1.0.0-r3 \
		--sbom-path "$(SCANNER_BUILD_DIR)/output" \
		images/node/alpine-runtime/apko.yaml hmpps-node-scanners:local \
		"$(SCANNER_BUILD_DIR)/output/image.tar" && \
	docker load --input "$(SCANNER_BUILD_DIR)/output/image.tar"
	docker run --rm --entrypoint hadolint hmpps-node-scanners:local-$(ARCH) --version
	docker run --rm --entrypoint snyk hmpps-node-scanners:local-$(ARCH) --version

apko:
	mkdir -p /tmp/hmpps-node-output && \
	ruby scripts/render-node-apko.rb "$(NODE_MAJOR)" runtime /tmp/hmpps-node-output/apko.yaml && \
	bash scripts/quiet-build.sh /tmp/hmpps-node-output/apko.log apko build --arch $(ARCH) --sbom-path /tmp/hmpps-node-output --build-date $(TIMESTAMP) /tmp/hmpps-node-output/apko.yaml $(IMAGE) /tmp/hmpps-node-output/hmpps-node-runtime.tar  && \
	docker load --input /tmp/hmpps-node-output/hmpps-node-runtime.tar && \
	docker tag $(IMAGE)-$(ARCH) runtime:local-$(ARCH)-$(TAG_TIMESTAMP) && \
	docker run --rm runtime:local-$(ARCH)-$(TAG_TIMESTAMP) --version
