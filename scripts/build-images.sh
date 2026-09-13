#!/usr/bin/env bash
#
# Builds this project's image HERE (a development machine) and packs it into
# a single tarball to carry to the server, so the server never has to build
# anything — and never has to reach Docker Hub.
#
# Unlike a heavy frontend build, this image is cheap to build anywhere (no
# compile step, no native modules). The reason to use this path is network,
# not CPU: on a filtered or throttled connection, pulling node:22-alpine on
# the server can be the slowest part of a deploy, or fail outright. Building
# here and shipping the result sidesteps that.
#
# Usage (on your own machine, from the project root):
#   ./scripts/build-images.sh
#   make images
#
# Options (environment variables):
#   PLATFORM=linux/arm64          target architecture, if the server is not x86-64
#   OUT=path/to/file.tar.gz       where to write the bundle
set -euo pipefail

cd "$(dirname "$0")/.."

PLATFORM="${PLATFORM:-linux/amd64}"
OUT="${OUT:-dist/nosrati-gym-image.tar.gz}"

# Kept in step with docker-compose.yml (image: nosrati-gym:${IMAGE_TAG:-latest}).
IMAGES=(nosrati-gym:latest)

echo "==> Building image for ${PLATFORM}"
echo ""

# compose interpolates the whole file before it will build anything. Nothing
# in .env is baked into the image — DOMAIN, ports and the initial admin
# password are all runtime settings — so a throwaway .env is enough here and
# is cleaned up afterwards, rather than making you create a real one on a
# machine that will never run the stack.
TEMP_ENV=0
if [[ ! -f .env ]]; then
  TEMP_ENV=1
  cp .env.example .env
  echo "    (using a temporary .env just to satisfy compose interpolation;"
  echo "     nothing from it is baked into the image)"
  echo ""
fi
cleanup() { [[ "$TEMP_ENV" == "1" ]] && rm -f .env; }
trap cleanup EXIT

DOCKER_DEFAULT_PLATFORM="$PLATFORM" docker compose build

echo ""
echo "==> Verifying the built image really is ${PLATFORM}"
# A mismatch here does not fail the build; it produces an image that loads
# fine on the server and then dies at startup with a bare "exec format
# error" — a confusing symptom to debug remotely. Cheaper to catch it now.
want_os="${PLATFORM%%/*}"
want_arch="${PLATFORM##*/}"
for img in "${IMAGES[@]}"; do
  got="$(docker image inspect "$img" --format '{{.Os}}/{{.Architecture}}')"
  if [[ "$got" != "${want_os}/${want_arch}" ]]; then
    echo "Error: ${img} is ${got}, but ${PLATFORM} was requested." >&2
    echo "       Loading this on the server would fail at runtime with" >&2
    echo "       \"exec format error\". Check your Docker buildx setup." >&2
    exit 1
  fi
  echo "    ${img}: ${got}"
done

echo ""
echo "==> Packing into ${OUT}"
mkdir -p "$(dirname "$OUT")"
# gzip -1: image layers are mostly already-compressed content, so the higher
# levels cost a lot of time for very little extra saving.
docker save "${IMAGES[@]}" | gzip -1 > "$OUT"

size="$(du -h "$OUT" | cut -f1)"
echo ""
echo "================================================================"
echo " Built: ${size}  ->  ${OUT}"
echo "================================================================"
echo ""
echo "Next, copy it to the server and load it there:"
echo ""
echo "  scp ${OUT} YOUR_USER@YOUR_SERVER:/opt/nosrati-gym/"
echo "  ssh YOUR_USER@YOUR_SERVER"
echo "  cd /opt/nosrati-gym && ./scripts/load-images.sh"
echo ""
