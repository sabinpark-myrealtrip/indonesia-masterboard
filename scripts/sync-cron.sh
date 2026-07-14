#!/bin/bash
# Runs the Supabase cache sync from this machine (inside the office/VPN network),
# since GitHub Actions' hosted runners cannot reach redash.myrealtrip.net (internal-only, 10.30.x.x).
# launchd only inherits a minimal PATH (no /opt/homebrew/bin), so npm's internal
# `env node` lookup fails with "node: No such file or directory" unless PATH is set here.
export PATH="/opt/homebrew/bin:$PATH"
cd "/Users/sabin-park/indonesia-masterboard" || exit 1
npm run sync:local
