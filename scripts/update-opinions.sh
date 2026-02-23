#!/bin/zsh

set -euo pipefail

git add .
git commit -m "Update opinion(s)"
git push

aws s3 sync . s3://opinions.jurisware.com \
  --delete \
  --exclude ".git/*" \
  --cache-control "public, max-age=0, must-revalidate"

# Set CF_DISTRIBUTION_ID in your shell/profile to enable invalidation.
if [[ -n "${CF_DISTRIBUTION_ID:-}" ]]; then
  aws cloudfront create-invalidation \
    --distribution-id "${CF_DISTRIBUTION_ID}" \
    --paths "/coa/*" "/*.md"
else
  echo "Skipping CloudFront invalidation: CF_DISTRIBUTION_ID is not set."
fi
