# Local Docker development

This setup runs the local Supabase stack from `backend/supabase` and the Vite
frontend. Supabase CLI starts its own containers through the mounted Docker
socket and applies pending migrations during startup.

## Start

1. From this directory, copy `.env.example` to `.env` and set
   `VITE_SUPABASE_ANON_KEY` to the local publishable key printed by Supabase.
2. Start the project from the `docker/` directory:

   ```sh
   docker compose up --build
   ```

Compose starts the local Supabase stack, serves all functions under
`backend/supabase/functions`, and then starts the frontend.

Open the frontend at <http://localhost:3000>. Supabase API is available at
<http://localhost:54321> and Studio at <http://localhost:54323>.
Local Edge Functions are available under
<http://localhost:54321/functions/v1/>.
For example, `manage-user` is served at
<http://localhost:54321/functions/v1/manage-user>. Its handler still requires
a signed-in admin bearer token; `verify_jwt = false` only disables gateway
verification and does not bypass the handler's authorization checks.

## Migrations and shutdown

The first `supabase start` applies all pending files in
`backend/supabase/migrations`. To discard local database data and replay every
migration, run:

```sh
docker compose run --rm supabase db reset
```

The Supabase CLI manages its stack outside Compose. Stop the whole local project
from this directory with:

```sh
./stop.sh
```