#!/bin/zsh

set -euo pipefail

# Hardcoded CloudFront Distribution ID
CF_DISTRIBUTION_ID="E2U16NO7NSYNDZ"

echo "Syncing to S3..."
aws s3 sync . s3://opinions.jurisware.com \
  --delete \
  --exclude ".git/*" \
  --cache-control "public, max-age=0, must-revalidate"

echo "Creating CloudFront invalidation..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/coa/*" "/*.md"

echo "Done."
