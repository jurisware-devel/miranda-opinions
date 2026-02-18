git add .
git commit -m "Update opinion(s)"
git push

aws s3 sync . s3://opinions.jurisware.com --delete
