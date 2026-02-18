git add .
git commit -m "Update opinion(s)"
git push

aws s3 sync ./miranda-opinions s3://opinions.jurisware.com --delete
