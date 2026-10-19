#!/bin/bash
# find.sh <host> : fetch the home page and list links that look like a curriculum / study guide.
D="$(cd "$(dirname "$0")" && pwd)"
bash $D/get.sh "https://$1/" "home-$1" >/dev/null 2>&1
python3 $D/links.py "$D/raw/home-$1.html" "https://$1" 2>/dev/null | grep -iE "πρόγραμμα σπουδών|προγραμμα σπουδων|οδηγ[όο]ς σπουδ|μαθήματα|programma|odhg|odig|curricul|courses|study guide|ppS|proptyx" | head -12
