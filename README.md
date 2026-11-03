# Mini Wine Cellar

A small wine cellar as one pnpm monorepo: a NestJS GraphQL API over PostgreSQL and a Next.js client
that reads and writes it through Apollo Client. A user picks one of three demo identities, adds bottles
to their own cellar, sees them newest first and likes them without a page reload.

There is no real authentication: the client sends `x-user-id: <uuid>`, the server resolves that id to a
user and rejects an unknown one, but nothing proves who is calling.

## What it does

- Pick one of three demo users: Alice, Bob or Carol.
- See only that user's bottles, newest first, with loading, empty and error states.
- Add a bottle — name, producer, vintage, region and an optional photo URL — validated in the browser
  and again on the server; a valid bottle appears at the top of the list straight away.
- Like a bottle: the count moves on click, is incremented in one statement in the database, and goes
  back with a toast if the request fails.
- Switch user and get the other cellar; another user's bottle can be neither read nor liked.

## Stack

- Node 22 and pnpm 11 workspaces; TypeScript strict in both packages.
- API: NestJS 11 with Apollo Server 5 (code-first, `apps/api/schema.gql` committed) and MikroORM 7
  on PostgreSQL 17 from Docker Compose, `class-validator` behind a global `ValidationPipe`.
- Web: Next.js 16 App Router with React 19, Apollo Client 4, Tailwind v4 and shadcn/ui; forms with
  react-hook-form and Zod.
- Quality: Biome for format and lint, Jest in both packages, GraphQL Codegen (`client-preset`) into
  `apps/web/src/gql`.

No version fallbacks were needed; exact pins live in each `package.json`.

## How it works

### Signing in means sending a header

`GraphQLModule` builds the context from the request and keeps the raw `x-user-id` header. On each
protected operation `CurrentUserGuard` resolves it through `UsersService` and attaches the `User`, which
resolvers read with `@CurrentUser()`; the `users` query stays public to fill the switcher. A missing
header and an unknown id end in the same `UnauthorizedException`, which `@nestjs/apollo` maps to
`extensions.code: "UNAUTHENTICATED"` inside an HTTP 200 body — the client watches that code, not a 401
status, drops the stored id (`mini-wine-cellar.current-user-id`) and asks for a user again.

### Ownership is enforced on the server

The bottle service receives the guard's `User`, so the owner comes from the request, never from the
client. `myBottles` is `WHERE owner_id = ?` ordered by `created_at DESC, id DESC` — the access path of
the `(owner_id, created_at DESC)` index. `likeBottle` is one statement, `UPDATE bottle SET likes_count =
likes_count + 1 WHERE id = ? AND owner_id = ?`, with the owner inside the `WHERE` clause instead of a
check in front of it: no read-modify-write window, no second query, and zero affected rows means "not
found" — the same message for a bottle that does not exist and one belonging to somebody else, and no
`owner` field on `Bottle` to widen the scope.

### The like: optimistic on the client, atomic in the database

The card reads the count from the Apollo cache at click time — its own pending optimistic layers
included — and writes an optimistic response of `+1`. Because that read happens on click and not at
render, ten rapid clicks compose to `+10` before any answer arrives, and a `likesCount` merge policy of
`Math.max` keeps a late, lower answer from moving the counter backwards. Apollo rolls the optimistic
layer back when the mutation fails, and the rejection becomes one toast with a stable id.

### The same rules and messages on both sides

`apps/web/src/lib/schemas/bottle.ts` holds the client rules and the server repeats them on
`AddBottleInput` with `class-validator`. Form values are strings: text fields are trimmed and capped at
120 characters, the vintage is a four-digit year from 1900 to the current one, and `photoUrl` is empty or
an `http(s)` URL with a real host — the rule mirrors `@IsUrl`, so `http://localhost:3000/l.png` is
refused by both. The server's messages are written out explicitly, because the defaults differ from the
wording the client shows, and the global `ValidationPipe` puts them into the GraphQL `message` itself
instead of Nest's wrapper. The duplication is deliberate: the browser answers without a round trip, and
the server trusts nothing it is sent.

### The schema is created by migrations only

`apps/api/mikro-orm.config.ts` feeds the application and the MikroORM CLI and enables neither
`schema.update()` nor `ensureDatabase`; tables appear only through `pnpm db:migrate`, and the seed adds
the demo rows afterwards. `apps/api/schema.gql` is generated from the code-first decorators and
committed; `apps/web/src/gql` is generated from it by codegen and committed too. Neither is edited by
hand, and `pnpm codegen` has to leave no diff.

## Project structure

```
mini-wine-cellar/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ config/           env parsing, one place, fails fast
│  │  │  ├─ auth/             x-user-id context, guard, @CurrentUser()
│  │  │  ├─ users/            User entity, GraphQL model, service, users query
│  │  │  ├─ bottles/          entity, model, DTO, service + unit test, resolver
│  │  │  ├─ migrations/       committed MikroORM migration
│  │  │  └─ seed/             idempotent seed of the demo users and bottles
│  │  ├─ mikro-orm.config.ts
│  │  ├─ schema.gql           generated, committed
│  │  └─ .env.example
│  └─ web/
│     ├─ src/
│     │  ├─ app/              layout, page, providers, globals.css
│     │  ├─ components/       user switcher, form, list, card, ui/ (shadcn)
│     │  ├─ lib/              apollo client, current-user context, schemas/
│     │  ├─ graphql/          operations.graphql
│     │  └─ gql/              codegen output, committed
│     └─ codegen.ts
├─ .github/workflows/ci.yml   the four checks on every push and pull request
├─ docker-compose.yml         postgres:17 only
├─ biome.json
├─ pnpm-workspace.yaml
└─ package.json               workspace scripts
```

## Running it locally

### Prerequisites

- Node 22 (`.nvmrc` pins the major; `engines.node` requires `>=22`).
- pnpm 11.5.2 — the version in `packageManager`, so `corepack enable` is enough.
- Docker with Compose, for the PostgreSQL container.

### Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm db:up          # postgres:17 on :5432, waits for the healthcheck
pnpm db:setup       # migrate + seed, idempotent
pnpm dev            # api :4000, web :3000
```

Then open <http://localhost:3000> and pick Alice, Bob or Carol in the switcher. The seed creates these
three users, and Alice owns three bottles so that the first list is not empty:

| User  | id                                     | Bottles |
| ----- | -------------------------------------- | ------- |
| Alice | `0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1001` | 3       |
| Bob   | `0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1002` | 0       |
| Carol | `0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1003` | 0       |

Apollo Sandbox is served at <http://localhost:4000/graphql> while the API runs in development, which
means `NODE_ENV=development` in `apps/api/.env` — an unset or different value is treated as production,
where the Sandbox and introspection are both off. The `users` query needs no header; for `myBottles`,
`addBottle` and `likeBottle` add `{"x-user-id": "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1001"}` in the Sandbox
header panel. With Alice's id the operations work, with Bob's id Alice's bottles are unreachable.

## Checking your work

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm codegen && git diff --exit-code apps/web/src/gql apps/api/schema.gql
```

- `pnpm lint` — Biome over the workspace; a failure is formatting or a lint rule, warnings included.
- `pnpm typecheck` — `tsc --noEmit` in both packages; a failure is a type error, including a form schema
  that drifted from the generated `AddBottleInput`.
- `pnpm test` — Jest in both packages; the tests need no database.
- The last line must print nothing: a diff in `apps/web/src/gql` means the committed codegen output is
  stale, a diff in `apps/api/schema.gql` means the committed schema no longer matches the decorators.

`.github/workflows/ci.yml` runs the same checks on every push and pull request, needs neither a database
nor an `.env` file — codegen reads the committed schema — and diffs `apps/web/src/gql`.

## Useful scripts

Run from the repository root.

| Command                                    | What it does                                            |
| ------------------------------------------ | ------------------------------------------------------- |
| `pnpm dev`                                 | API and web in parallel, `:4000` and `:3000`            |
| `pnpm build`                               | `nest build` and `next build`                           |
| `pnpm lint`                                | Biome check across the workspace, zero warnings allowed |
| `pnpm format`                              | Biome check with `--write`                              |
| `pnpm typecheck`                           | `tsc --noEmit` in every package                         |
| `pnpm test`                                | Jest in every package; needs no database                |
| `pnpm codegen`                             | GraphQL Codegen into `apps/web/src/gql`                 |
| `pnpm db:up`                               | `docker compose up -d --wait`                           |
| `pnpm db:migrate` / `pnpm db:seed`         | Run the pending migrations / insert the demo data       |
| `pnpm db:setup`                            | `db:up` + `db:migrate` + `db:seed`                      |
| `pnpm --filter api migration:create`         | New migration from the entity diff (`--name <slug>` names it) |
| `pnpm --filter api migration:up` / `:down`  | Apply / revert the last migration on the local database |

## Assumptions

- **Like = increment-only counter.** One number per bottle, belonging to that bottle's owner. There
  is no unlike, no toggle, no "who liked" and no per-user like record.
- **The photo is a URL.** `photoUrl` stores a string that must be an `http(s)` URL or empty; there is
  no upload, no bucket and no image processing.
- **No pagination, edit, delete, search, filters or sorting options.** One user's list is short by
  design.
- **The login is a placeholder.** `x-user-id` demonstrates ownership, not authentication; nothing in
  the app proves that the caller is the user the header names.

The five written answers to the interview questions live in [`ANSWERS.md`](ANSWERS.md).

## Troubleshooting

- **Port 5432 is already in use.** Another PostgreSQL is running. Change the host side of the mapping
  in `docker-compose.yml` (for example `"127.0.0.1:5433:5432"`) and the port in `DATABASE_URL` in
  `apps/api/.env`, then run `pnpm db:up` and `pnpm db:setup`.
- **A migration or the seed failed.** Reset the local database and start over:
  `docker compose down -v` (this deletes the `pgdata` volume), then `pnpm db:setup`.
- **The web app cannot reach the API.** Check `NEXT_PUBLIC_API_URL` in `apps/web/.env` (the example
  file points at `http://localhost:4000/graphql`) and `WEB_ORIGIN` in `apps/api/.env` (the API's CORS
  origin, `http://localhost:3000` in the example). Both are read at start-up, so restart `pnpm dev`
  after editing them.
- **Apollo Sandbox and introspection are missing.** The API treats an unset `NODE_ENV` and any value
  other than `development` as production, where internal error messages are replaced with a neutral one
  as well. Local development sets `NODE_ENV=development` in `apps/api/.env`; never copy `.env.example`
  into a deploy, because it carries exactly that line.
- **The app asks for a user although one was picked.** The stored id
  (`mini-wine-cellar.current-user-id` in Local Storage) no longer names an existing user — the database
  was reset, for example. Pick a user in the switcher again, or clear that key.
