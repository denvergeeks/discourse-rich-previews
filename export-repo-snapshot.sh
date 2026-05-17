#!/usr/bin/env bash
set -euo pipefail

mkdir -p _export

repo_name="$(basename "$PWD")"
branch_name="$(git rev-parse --abbrev-ref HEAD)"
commit_sha="$(git rev-parse HEAD)"
generated_at="$(date '+%Y-%m-%d %H:%M:%S %z')"

baseline_file="_export/repo-baseline.txt"
tree_file="_export/repo-tree.txt"
meta_file="_export/repo-meta.txt"

git ls-files > "$tree_file"

{
  echo "REPO: $repo_name"
  echo "BRANCH: $branch_name"
  echo "COMMIT: $commit_sha"
  echo "GENERATED: $generated_at"
} > "$meta_file"

{
  echo "REPO: $repo_name"
  echo "BRANCH: $branch_name"
  echo "COMMIT: $commit_sha"
  echo "GENERATED: $generated_at"
  echo
  echo "=== FILE TREE ==="
  cat "$tree_file"
  echo
  echo "=== FILE CONTENTS ==="
  echo
} > "$baseline_file"

while IFS= read -r file; do
  case "$file" in
    _export/*|node_modules/*|.git/*)
      continue
      ;;
  esac

  case "$file" in
    *.js|*.gjs|*.ts|*.gts|*.hbs|*.json|*.yml|*.yaml|*.scss|*.css|*.rb|*.md|*.txt|*.html|*.mjs|*.cjs|*.toml|*.conf|\
    README.md|LICENSE|Gemfile|Gemfile.lock|package.json|pnpm-lock.yaml|settings.yml|about.json|\
    .discourse-compatibility|.gitignore|.npmrc|.prettierrc.cjs|.rubocop.yml|.streerc|.template-lintrc.cjs|\
    eslint.config.mjs|jsconfig.json|stylelint.config.mjs|tsconfig.json)
      ;;
    *)
      continue
      ;;
  esac

  lang=""
  case "$file" in
    *.js|*.gjs|*.mjs|*.cjs) lang="js" ;;
    *.ts|*.gts) lang="ts" ;;
    *.hbs) lang="hbs" ;;
    *.json) lang="json" ;;
    *.yml) lang="yml" ;;
    *.yaml) lang="yaml" ;;
    *.scss) lang="scss" ;;
    *.css) lang="css" ;;
    *.rb) lang="rb" ;;
    *.md) lang="md" ;;
    *.html) lang="html" ;;
  esac

  {
    echo "=== FILE: $file ==="
    echo "\`\`\`$lang"
    cat "$file"
    echo
    echo "\`\`\`"
    echo
  } >> "$baseline_file"
done < "$tree_file"

echo
echo "Export complete."
echo "Commit: $commit_sha"
echo "Files created:"
echo " - $meta_file"
echo " - $tree_file"
echo " - $baseline_file"
echo