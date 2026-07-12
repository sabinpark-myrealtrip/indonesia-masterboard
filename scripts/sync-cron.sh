#!/bin/bash
# Runs the Supabase cache sync from this machine (inside the office/VPN network),
# since GitHub Actions' hosted runners cannot reach redash.myrealtrip.net (internal-only, 10.30.x.x).
cd "/Users/sabin-park/indonesia-masterboard" || exit 1
/opt/homebrew/bin/npm run sync:local
