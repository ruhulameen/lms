#!/bin/sh
# Starts the app container: bring the database up to date, make sure the roles
# and the admin account exist, build once, then serve.
set -e

echo "[start] applying database migrations"
pnpm migrate:deploy

# The seed is safe to repeat. Sample courses, learners and posts are only
# created when SEED_SAMPLES=true (the seed skips them in production mode).
if [ "$SEED_SAMPLES" = "true" ]; then
  echo "[start] seeding with sample content"
  NODE_ENV=development pnpm db:seed
else
  echo "[start] seeding roles, permissions and the admin account"
  NODE_ENV=production pnpm db:seed
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "[start] building (first start of this container, takes a minute or two)"
  pnpm build
fi

echo "[start] serving on port 3000"
exec node_modules/.bin/next start --hostname 0.0.0.0 --port 3000
