import { join } from "node:path";

/**
 * Variables the API cannot start without. `PORT` is absent on purpose: it has a default.
 */
const REQUIRED_VARIABLES = ["DATABASE_URL", "WEB_ORIGIN"] as const;

const DEFAULT_PORT = 4000;

const MIN_PORT = 1;
const MAX_PORT = 65_535;

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export interface AppEnv {
  readonly DATABASE_URL: string;
  readonly PORT: number;
  readonly WEB_ORIGIN: string;
}

/**
 * `pnpm --filter api <script>`, the MikroORM CLI and the seed script all run with
 * `cwd = apps/api`, so the package `.env` is the single source for the app and the CLI.
 * Node's built-in loader is used instead of `dotenv`, and it never overrides a
 * variable that is already exported, so `DATABASE_URL=... pnpm --filter api dev` wins.
 * variable that is already exported, so `DATABASE_URL=... pnpm --filter api dev` wins.
 */
const envFile = join(process.cwd(), ".env");

try {
  process.loadEnvFile(envFile);
} catch (error) {
  // A missing `.env` is a supported state: exported variables are enough, and the check
  // below turns an incomplete environment into one message naming every missing name.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

function readRequired(name: (typeof REQUIRED_VARIABLES)[number]): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    // Unreachable when the collected check below runs first; keeps the return type honest.
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return value;
}

function readPort(): number {
  const raw = process.env.PORT;

  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`Invalid PORT: expected an integer between 1 and 65535, received "${raw}".`);
  }

  return port;
}

/**
 * `WEB_ORIGIN` ends up in the CORS header, so it is parsed instead of merely present: a bare `*`,
 * an empty value and a protocol-relative one all fail. The accepted value is normalized to
 * `url.origin` before it reaches CORS, because a browser's `Origin` header is always the bare
 * `scheme://host[:port]` — a trailing slash, a path or an explicitly written default port in the
 * variable would otherwise never match. Origins are not secrets, so the failing protocol is echoed,
 * as `PORT` echoes its value; the whole URL is not, because it can carry a userinfo pair.
 */
function readWebOrigin(): string {
  const value = readRequired("WEB_ORIGIN");

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    // Nothing is echoed: a value that does not parse can still contain a userinfo pair, and there
    // is no protocol to name either.
    throw new Error("Invalid WEB_ORIGIN: expected an http:// or https:// origin.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Invalid WEB_ORIGIN: expected the http:// or https:// protocol, received "${url.protocol}".`,
    );
  }

  return url.origin;
}

function readDatabaseUrl(): string {
  const value = readRequired("DATABASE_URL");

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    // The value itself is never echoed: it carries the password.
    throw new Error("Invalid DATABASE_URL: expected a postgresql:// connection string.");
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `Invalid DATABASE_URL: expected the postgres:// or postgresql:// protocol, received "${url.protocol}".`,
    );
  }

  return value;
}

// Fail fast once, naming every missing variable and never a value.
const missingVariables = REQUIRED_VARIABLES.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingVariables.join(", ")}. ` +
      "Copy apps/api/.env.example to apps/api/.env and fill in the values.",
  );
}

export const env: AppEnv = {
  DATABASE_URL: readDatabaseUrl(),
  PORT: readPort(),
  WEB_ORIGIN: readWebOrigin(),
};

/**
 * The Apollo landing page and introspection are local-development conveniences, not part of the
 * API contract: both stay off outside `development`. Production is the default state — a
 * deploy that sets no `NODE_ENV` gets the safe answer, and development has to be opted into with
 * `NODE_ENV=development` in `apps/api/.env`.
 */
export const isProduction = process.env.NODE_ENV !== "development";
