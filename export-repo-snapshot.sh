#!/usr/bin/env bash
# ============================================================
# export-repo-snapshot.sh
# Fetches every source file from denvergeeks/discourse-rich-previews
# (default branch) via the GitHub raw API and writes them into
# a local snapshot directory.  Upload the resulting directory
# (or zip it up) to share with a collaborator or AI assistant.
#
# Usage:
#   chmod +x export-repo-snapshot.sh
#   ./export-repo-snapshot.sh
#   # optional: add GITHUB_TOKEN for private repos or higher rate-limits
#   GITHUB_TOKEN=ghp_xxx ./export-repo-snapshot.sh
# ============================================================

set -euo pipefail

OWNER="denvergeeks"
REPO="discourse-rich-previews"
BRANCH="main"                              # change if your default branch differs
OUT_DIR="./snapshot-${REPO}"
API_BASE="https://api.github.com/repos/${OWNER}/${REPO}"
RAW_BASE="https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}"

# Auth header (empty string if no token)
AUTH_HEADER=""
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  AUTH_HEADER="Authorization: Bearer ${GITHUB_TOKEN}"
fi

# Directories to skip entirely
SKIP_DIRS=()

# Files to skip (exact repo-relative paths)
SKIP_FILES=(
  "pnpm-lock.yaml"
  "Gemfile.lock"
)

# ── helpers ─────────────────────────────────────────────────

curl_json() {
  local url="$1"
  if [[ -n "$AUTH_HEADER" ]]; then
    curl -fsSL -H "$AUTH_HEADER" -H "Accept: application/vnd.github+json" "$url"
  else
    curl -fsSL -H "Accept: application/vnd.github+json" "$url"
  fi
}

should_skip_file() {
  local path="$1"
  for pattern in "${SKIP_FILES[@]}"; do
    if [[ "$path" == $pattern ]]; then
      return 0
    fi
  done
  return 1
}

should_skip_dir() {
  local dir="$1"
  for d in "${SKIP_DIRS[@]}"; do
    if [[ "$dir" == "$d" || "$dir" == "$d/"* ]]; then
      return 0
    fi
  done
  return 1
}

download_file() {
  local repo_path="$1"
  local local_path="${OUT_DIR}/${repo_path}"
  mkdir -p "$(dirname "$local_path")"
  local url="${RAW_BASE}/${repo_path}"
  if [[ -n "$AUTH_HEADER" ]]; then
    curl -fsSL -H "$AUTH_HEADER" -o "$local_path" "$url"
  else
    curl -fsSL -o "$local_path" "$url"
  fi
  echo "  ✔  ${repo_path}"
}

# Recursive tree walker using the GitHub Trees API
walk_tree() {
  local tree_sha="$1"
  local prefix="$2"

  local json
  json=$(curl_json "${API_BASE}/git/trees/${tree_sha}")

  local count
  count=$(echo "$json" | jq '.tree | length')

  for i in $(seq 0 $((count - 1))); do
    local entry_type entry_path entry_sha
    entry_type=$(echo "$json" | jq -r ".tree[$i].type")
    entry_path=$(echo "$json" | jq -r ".tree[$i].path")
    entry_sha=$(echo "$json"  | jq -r ".tree[$i].sha")

    local full_path="${prefix}${entry_path}"

    if [[ "$entry_type" == "tree" ]]; then
      if should_skip_dir "$full_path"; then
        echo "  ⏭  skipping dir: ${full_path}"
        continue
      fi
      walk_tree "$entry_sha" "${full_path}/"
    elif [[ "$entry_type" == "blob" ]]; then
      if should_skip_file "$full_path"; then
        echo "  ⏭  skipping file: ${full_path}"
        continue
      fi
      download_file "$full_path"
    fi
  done
}

# ── main ────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  discourse-rich-previews  →  repo snapshot export   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if ! command -v jq &>/dev/null; then
  echo "ERROR: 'jq' is required but not installed."
  echo "  macOS:  brew install jq"
  echo "  Ubuntu: sudo apt-get install jq"
  exit 1
fi

echo "► Resolving HEAD commit for branch '${BRANCH}' …"
HEAD_SHA=$(curl_json "${API_BASE}/commits/${BRANCH}" | jq -r '.sha')
echo "  commit: ${HEAD_SHA}"

echo "► Fetching root tree …"
ROOT_TREE_SHA=$(curl_json "${API_BASE}/git/commits/${HEAD_SHA}" | jq -r '.tree.sha')

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "► Downloading files into '${OUT_DIR}/' …"
echo ""
walk_tree "$ROOT_TREE_SHA" ""

echo ""
echo "► Writing snapshot metadata …"
cat > "${OUT_DIR}/_SNAPSHOT_INFO.txt" << META
Repo    : https://github.com/${OWNER}/${REPO}
Branch  : ${BRANCH}
Commit  : ${HEAD_SHA}
Exported: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
META

echo ""
echo "✅  Snapshot complete → ${OUT_DIR}/"
echo ""
echo "To zip for upload:"
echo "   zip -r snapshot-${REPO}.zip ${OUT_DIR}/"
echo ""