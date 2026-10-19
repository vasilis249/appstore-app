#!/bin/bash
# sub.sh <url> <name>: fetch a page, list its sub-page links (same path prefix) and every PDF/DOC link.
D="$(cd "$(dirname "$0")" && pwd)"
bash $D/get.sh "$1" "$2"
p=$(echo "$1" | sed -E 's#https?://[^/]+##; s#/$##')
grep -oE 'href="[^"]+"' "$D/raw/$2.html" | sed 's/href="//; s/"$//' | grep -E "^($p/|https?://[^/]+$p/)|\.(pdf|docx?)$" | sort -u
