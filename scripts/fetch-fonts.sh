#!/bin/sh
# Puts the licensed MonoLisa web font into site/public/fonts/ before a build: MonoLisa.css and the WOFF2
# subsets it declares. The font licence forbids sharing the files, so they live in the private repo
# slimcandy/monolisa-font and never in this public one. Optional: without them the build still
# works and code uses the system monospace font.
#
# Netlify env var (builds scope):
#   FONTS_DEPLOY_KEY  base64 of a read-only deploy key for slimcandy/monolisa-font

set -e
DIR=site/public/fonts
REPO=git@github.com:slimcandy/monolisa-font.git

[ -f "$DIR/MonoLisa.css" ] && exit 0

if [ -z "$FONTS_DEPLOY_KEY" ]; then
  echo "fetch-fonts: MonoLisa not found, using system monospace (set FONTS_DEPLOY_KEY to fetch it)"
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "$FONTS_DEPLOY_KEY" | base64 -d > "$TMP/key"
chmod 600 "$TMP/key"
# GitHub's published SSH host key (https://api.github.com/meta).
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > "$TMP/known_hosts"

GIT_SSH_COMMAND="ssh -i $TMP/key -o IdentitiesOnly=yes -o UserKnownHostsFile=$TMP/known_hosts" \
  git clone --quiet --depth 1 "$REPO" "$TMP/repo"

mkdir -p "$DIR"
cp "$TMP/repo/woff2/"* "$DIR/"
echo "fetch-fonts: added MonoLisa.css and $(ls "$TMP/repo/woff2" | grep -c woff2) WOFF2 files"
