import { MikroORM } from "@mikro-orm/core";
import { BadRequestException, Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { ValidationError } from "class-validator";
import { AppModule } from "./app.module";
import { env } from "./config/env";

/**
 * The client and the server must report the same message for the same input, and the client shows
 * what the server answered. Nest's default factory wraps every violation in "Bad Request
 * Exception" and leaves the real wording in `extensions.originalError`, so this one puts the
 * field messages into the GraphQL `message` itself, joined in the order the fields were validated.
 * messages into the GraphQL `message` itself, joined in the order the fields were validated.
 */
function validationMessage(errors: readonly ValidationError[]): string {
  return errors
    .flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      validationMessage(error.children ?? []),
    ])
    .filter((message) => message.length > 0)
    .join("; ");
}
/** Deeper than any cause chain this app builds; guards against a self-referencing `cause`. */
const MAX_ERROR_DEPTH = 4;

/**
 * One line the operator can act on, for an error of any shape.
 *
 * Node's happy-eyeballs failure is the reason this exists: connecting to `localhost` tries both
 * `::1` and `127.0.0.1`, and when both are refused Node throws an `AggregateError` whose own
 * `message` is `""` — the reasons live in `errors`, one per address. `Logger.error(message)` then
 * prints an empty line, which is exactly the unusable `ERROR [Bootstrap]` this helper replaces.
 * The `code` (`ECONNREFUSED`) is added because a message may omit it, and `cause` is followed
 * because an `AggregateError` is not the only node that hides the real failure.
 */
function describeError(error: unknown, depth = 0): string {
  if (!(error instanceof Error)) {
    return `non-error thrown: ${String(error)}`;
  }

  const parts = [error.message.trim().length > 0 ? error.message : error.name];

  if ("code" in error && typeof error.code === "string") {
    parts.push(`[${error.code}]`);
  }

  if (depth >= MAX_ERROR_DEPTH) {
    return parts.join(" ");
  }

  const nested: unknown[] = error instanceof AggregateError ? [...error.errors] : [];

  if (error.cause !== undefined) {
    nested.push(error.cause);
  }

  if (nested.length > 0) {
    parts.push(`(caused by: ${nested.map((inner) => describeError(inner, depth + 1)).join("; ")})`);
  }

  return parts.join(" ");
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: env.WEB_ORIGIN });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(validationMessage(errors)),
    }),
  );
  app.enableShutdownHooks();

  // MikroORM opens its pool lazily, so an unreachable database would surface at the first
  // query instead of at boot. Prove it answers before the HTTP server accepts requests.
  await app.get(MikroORM).em.getConnection().execute("select 1");
  Logger.log("Database connection verified", "Bootstrap");

  await app.listen(env.PORT);
  Logger.log(`GraphQL API listening on ${await app.getUrl()}`, "Bootstrap");
}

bootstrap().catch((error: unknown) => {
  // The stack is passed separately so Nest prints it below the message instead of inside it.
  Logger.error(describeError(error), error instanceof Error ? error.stack : undefined, "Bootstrap");
  process.exit(1);
});
