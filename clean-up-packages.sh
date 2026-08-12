#!/usr/bin/env bash

set -euo pipefail

ORG="ministryofjustice"
DRY_RUN=false

packages=$(
  gh api \
    "/orgs/${ORG}/packages?package_type=container" \
    --paginate \
    --jq '.[].name'
)

for package in ${packages}; do
  [[ "${package}" != hmpps-hardened-* ]] && continue

  echo
  echo "Processing / Deleting ${package}..."
  if [[ "${DRY_RUN}" == "false" ]]; then
    gh api \
      -X DELETE \
      "/orgs/${ORG}/packages/container/${package}" || true
  fi
  # gh api \
  #   "/orgs/${ORG}/packages/container/${package}/versions" \
  #   --paginate |
  #   jq -c '.[]' |
  #   while read -r version; do

  #     version_id=$(echo "${version}" | jq -r '.id')

  #     keep=false

  #     while read -r tag; do
  #       [[ -z "${tag}" ]] && continue

  #       # Keep release tags such as v1.0.0
  #       if [[ "${tag}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  #         keep=true
  #       fi
  #     done < <(
  #       echo "${version}" | jq -r '.metadata.container.tags[]?'
  #     )

  #     if [[ "${keep}" == "false" ]]; then
  #       tags=$(echo "${version}" | jq -c '.metadata.container.tags // []')

  #       echo "DELETE ${package}"
  #       echo "  Version ID: ${version_id}"
  #       echo "  Tags: ${tags}"

  #       if [[ "${DRY_RUN}" == "false" ]]; then
  #         gh api \
  #           -X DELETE \
  #           "/orgs/${ORG}/packages/container/${package}/versions/${version_id}" || true
  #       fi
  #     fi
  #   done
done
