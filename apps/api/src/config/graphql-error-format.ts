import { HttpStatus, Logger } from "@nestjs/common";
import type { GraphQLFormattedError } from "graphql";

const logger = new Logger("GraphQLError");

/**
 * Two rewrites of the error the client receives, applied by the driver's `formatError` hook, which
 * calls this as `(formattedError, thrown)`:
 *  - `extensions.code = "NOT_FOUND"` when a bottle does not exist or is not the caller's.
 *    `@nestjs/apollo` maps only 400/401/403/422 to a code and drops every other
 *    `HttpException` to `INTERNAL_SERVER_ERROR`, keeping the HTTP status in `extensions.status`;
 *    this renames that one case. The driver's own mapping runs first, so the other codes and
 *    their messages are untouched.
 *  - Not every failure is a Nest `HttpException`. A MikroORM/pg driver error (constraint
 *    violation, malformed SQL) also arrives as `INTERNAL_SERVER_ERROR`, carrying a raw `message`
 *    that can name columns and constraints. In production that message is replaced with a
 *    neutral one and the original goes to the API log; outside production it is kept as is, so
 *    local failures stay debuggable.
 *
 * `extensions.stacktrace` is not this function's business: Apollo's normalizer attaches it, and
 * `includeStacktraceInErrorResponses` in `app.module.ts` is what keeps it off the production
 * answer. `isProduction` is a parameter rather than an import of `./env`, so the behaviour can be
 * exercised without a `DATABASE_URL` and a `WEB_ORIGIN`.
 */
export function formatGraphqlError(
  formattedError: GraphQLFormattedError,
  thrown: unknown,
  isProduction: boolean,
): GraphQLFormattedError {
  // The 404 case is checked first: such an exception also carries `INTERNAL_SERVER_ERROR`, so
  // redacting before this branch would lose the `NOT_FOUND` code.
  if (formattedError.extensions?.status === HttpStatus.NOT_FOUND) {
    return {
      ...formattedError,
      extensions: { ...formattedError.extensions, code: "NOT_FOUND" },
    };
  }

  if (isProduction && formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
    // The message goes to the log only. `thrown` is the exception the driver received, so its
    // stack is the useful one; `extensions.originalError` holds a response object, not an Error.
    logger.error(formattedError.message, thrown instanceof Error ? thrown.stack : undefined);

    // Whitelisted extensions: `originalError` and `status` would hand the raw message of any
    // `HttpException` outside 400/401/403/422 back to the client.
    return {
      ...formattedError,
      message: "Internal server error",
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    };
  }

  return formattedError;
}
