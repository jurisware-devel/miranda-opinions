#!/bin/zsh

aws s3 sync s3://opinions.jurisware.com ~/Projects/miranda-opinions --delete --exclude ".git/*"
