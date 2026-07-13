#!/bin/sh
set -eu

if [ -x "./.venv-data/bin/python" ]; then
  exec ./.venv-data/bin/python scripts/collect_market_snapshot.py "$@"
fi

exec python3 scripts/collect_market_snapshot.py "$@"
