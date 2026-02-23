@echo off

git add .
git commit -m "Update opinion(s)"
git push

aws s3 sync . s3://opinions.jurisware.com ^
  --delete ^
  --exclude ".git/*" ^
  --cache-control "public, max-age=0, must-revalidate"

REM Check if CF_DISTRIBUTION_ID is set
IF NOT "%CF_DISTRIBUTION_ID%"=="" (
    echo Creating CloudFront invalidation...
    aws cloudfront create-invalidation ^
        --distribution-id "%CF_DISTRIBUTION_ID%" ^
        --paths "/coa/*" "/*.md"
) ELSE (
    echo Skipping CloudFront invalidation: CF_DISTRIBUTION_ID is not set.
)