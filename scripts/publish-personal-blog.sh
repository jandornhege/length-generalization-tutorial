#!/bin/sh
# Publish the shared manuscript to the personal GitHub Pages repository.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
REMOTE=https://github.com/jandornhege/length-generalization-tutorial.git
TUTORIAL_TOLA=${TOLA_BIN:-"$ROOT/.tools/tola"}
if [ ! -x "$TUTORIAL_TOLA" ]; then TUTORIAL_TOLA=tola; fi
EXPORT="$ROOT/tutorial_dual/tmp/github-pages"
"$TUTORIAL_TOLA" build -C tutorial_dual/tola.toml --offline \
  --origin https://jandornhege.github.io \
  --base-path /length-generalization-tutorial/ --publish-dir "$EXPORT"
touch "$EXPORT/.nojekyll"
DEPLOY=$(mktemp -d "${TMPDIR:-/tmp}/tutorial-pages.XXXXXX")
trap 'rm -rf "$DEPLOY"' EXIT HUP INT TERM
git init -q -b gh-pages "$DEPLOY"
git -C "$DEPLOY" remote add origin "$REMOTE"
if [ -n "$(git ls-remote --heads "$REMOTE" refs/heads/gh-pages)" ]; then
  git -C "$DEPLOY" fetch -q origin gh-pages
  git -C "$DEPLOY" reset --hard FETCH_HEAD
fi
git -C "$DEPLOY" rm -r -q --ignore-unmatch .
cp -R "$EXPORT/." "$DEPLOY/"
git -C "$DEPLOY" add .
if ! git -C "$DEPLOY" diff --cached --quiet; then
  SOURCE_COMMIT=$(git rev-parse --short HEAD)
  git -C "$DEPLOY" commit -m "Publish tutorial from source $SOURCE_COMMIT"
  git -C "$DEPLOY" push origin gh-pages
else
  echo 'Published files already match the current build.'
fi
printf '%s\n' 'Blog: https://jandornhege.github.io/length-generalization-tutorial/'
