#!/usr/bin/env bash
# Build the Apple Silicon .dmg and publish it to GitHub Releases.
#
# Usage:
#   ./publish-mac.sh
#   ./publish-mac.sh --tag v1.0.4
#   ./publish-mac.sh --version 0.1.4 --tag v1.0.4
#   ./publish-mac.sh --skip-build          # reuse an existing dmg
#   ./publish-mac.sh --skip-publish        # build only
#   ./publish-mac.sh --draft
#   ./publish-mac.sh --dry-run

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

TAG=""
NEW_VERSION=""
SKIP_BUILD=0
SKIP_PUBLISH=0
DRAFT=0
DRY_RUN=0
ALLOW_DIRTY=0
NOTES_FILE=""

usage() {
  cat <<'EOF'
Build the macOS .dmg and publish it to GitHub Releases.

Options:
  --tag TAG           GitHub release tag (default: v<app version>)
  --version X.Y.Z     Update package.json, tauri.conf.json, and Cargo.toml first
  --notes-file FILE   Release notes markdown file (default: generated)
  --draft             Create the GitHub release as a draft
  --skip-build        Skip yarn tauri:build; upload an existing .dmg
  --skip-publish      Build only; do not create or update a GitHub release
  --allow-dirty       Do not warn about uncommitted changes
  --dry-run           Print actions without building or publishing
  -h, --help          Show this help

Examples:
  ./publish-mac.sh
  ./publish-mac.sh --tag v1.0.4
  ./publish-mac.sh --version 0.1.4 --tag v1.0.4
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:?--tag requires a value}"
      shift 2
      ;;
    --version)
      NEW_VERSION="${2:?--version requires a value}"
      shift 2
      ;;
    --notes-file)
      NOTES_FILE="${2:?--notes-file requires a value}"
      shift 2
      ;;
    --draft) DRAFT=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --skip-publish) SKIP_PUBLISH=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script only builds the Mac app. Run it on macOS." >&2
  exit 1
fi

app_version() {
  node -e "console.log(require('./src-tauri/tauri.conf.json').package.version)"
}

set_app_version() {
  local version="$1"
  node -e '
    const fs = require("fs");
    const version = process.argv[1];
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    packageJson.version = version;
    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, "\t") + "\n");
    const tauri = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
    tauri.package.version = version;
    fs.writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(tauri, null, 2) + "\n");
  ' "$version"
  python3 - "$version" <<'PY'
import pathlib, re, sys
version = sys.argv[1]
path = pathlib.Path("src-tauri/Cargo.toml")
text = path.read_text()
path.write_text(re.sub(r'^version = "[^"]+"', f'version = "{version}"', text, count=1, flags=re.M))
PY
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

if [[ -n "$NEW_VERSION" ]]; then
  if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Version must look like 0.1.4, got: $NEW_VERSION" >&2
    exit 1
  fi
  echo "Setting app version to $NEW_VERSION"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] update package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml"
  else
    set_app_version "$NEW_VERSION"
  fi
fi

VERSION="$(app_version)"
if [[ "$DRY_RUN" -eq 1 && -n "$NEW_VERSION" ]]; then
  VERSION="$NEW_VERSION"
fi
DMG_NAME="rustinx_${VERSION}_aarch64.dmg"
if [[ -z "$TAG" ]]; then
  TAG="v${VERSION}"
fi

if [[ "$ALLOW_DIRTY" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree has uncommitted changes. Commit them, or pass --allow-dirty." >&2
    git status --short >&2
    exit 1
  fi
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  if [[ -d .parcel-cache ]]; then
    echo "Clearing Parcel cache..."
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "[dry-run] rm -rf .parcel-cache"
    else
      rm -rf .parcel-cache 2>/dev/null || sudo rm -rf .parcel-cache
    fi
  fi

  echo "Building frontend and Tauri .dmg (version $VERSION)..."
  run yarn install
  run yarn tauri:build
fi

DMG_PATH=""
expected_dmg="src-tauri/target/release/bundle/dmg/${DMG_NAME}"
if [[ "$DRY_RUN" -eq 1 ]]; then
  DMG_PATH="$expected_dmg"
else
  shopt -s nullglob
  dmg_candidates=(src-tauri/target/release/bundle/dmg/*.dmg)
  shopt -u nullglob
  if [[ ${#dmg_candidates[@]} -eq 0 ]]; then
    echo "No .dmg found in src-tauri/target/release/bundle/dmg/." >&2
    echo "Run without --skip-build, or build with: yarn tauri:build" >&2
    exit 1
  fi
  if [[ -f "$expected_dmg" ]]; then
    DMG_PATH="$expected_dmg"
  else
    DMG_PATH="${dmg_candidates[0]}"
    DMG_NAME="$(basename "$DMG_PATH")"
  fi
fi

echo "DMG: $DMG_PATH"
echo "GitHub tag: $TAG"

if [[ "$SKIP_PUBLISH" -eq 1 ]]; then
  echo "Skipping publish (--skip-publish). Installer is at:"
  echo "  $DMG_PATH"
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required to publish. Install GitHub CLI: https://cli.github.com" >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 0 ]] && ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

TMP_NOTES=""
cleanup_notes() {
  if [[ -n "$TMP_NOTES" && -f "$TMP_NOTES" ]]; then
    rm -f "$TMP_NOTES"
  fi
}
trap cleanup_notes EXIT

if [[ -z "$NOTES_FILE" ]]; then
  TMP_NOTES="$(mktemp)"
  NOTES_FILE="$TMP_NOTES"
  cat > "$NOTES_FILE" <<EOF
macOS is now available as a \`.dmg\` installer for Apple Silicon.

## macOS
1. Download \`${DMG_NAME}\`.
2. Open the disk image and drag **rustinx** into **Applications**.
3. Launch **rustinx** from Applications or Spotlight.

If macOS blocks the app as an unidentified developer:

\`\`\`bash
xattr -cr /Applications/rustinx.app
\`\`\`

Then open the app again, or right-click it and choose **Open**.

Rustinx expects Homebrew Nginx (\`brew install nginx\`). Enter your sudo password in the app login screen; you do not need to launch the app with \`sudo\`.

## Linux
Linux \`.AppImage\` and \`.deb\` packages remain on the [v1.0.2](https://github.com/charlesinwald/rustinx-react/releases/tag/v1.0.2) release.
EOF
fi

if [[ "$DRY_RUN" -eq 0 ]] && gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists; uploading ${DMG_NAME}..."
  run gh release upload "$TAG" "$DMG_PATH" --clobber
else
  create_args=(release create "$TAG" --title "$TAG" --notes-file "$NOTES_FILE" "$DMG_PATH")
  if [[ "$DRAFT" -eq 1 ]]; then
    create_args+=(--draft)
  fi
  echo "Creating GitHub release $TAG..."
  run gh "${create_args[@]}"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run complete. Would publish $DMG_PATH as $TAG"
else
  echo "Published: $(gh release view "$TAG" --json url --jq .url)"
fi
