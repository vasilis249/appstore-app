#!/bin/bash
# get.sh <url> <name> : fetch a page (follow redirects) into raw/<name>.html and print size + a text preview.
D="$(cd "$(dirname "$0")" && pwd)"
curl -sSL -m 40 --retry 4 --retry-all-errors --retry-delay 3 -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36" -o "$D/raw/$2.html" -w "%{http_code} %{url_effective} %{size_download}\n" "$1"
