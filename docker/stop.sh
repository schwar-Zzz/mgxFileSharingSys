#!/bin/sh
set -eu

cd "$(dirname "$0")"

docker compose run --rm supabase stop
docker compose down