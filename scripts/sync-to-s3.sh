#!/bin/zsh

aws s3 sync ~/Projects/miranda-opinions s3://opinions.jurisware.com --delete
