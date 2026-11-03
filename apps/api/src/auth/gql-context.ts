import type { IncomingHttpHeaders } from "node:http";
import type { User } from "../users/user.entity";

/**
 * The fake login.
 *
 * A stand-in for a real identity provider. Replacing it means verifying a Cognito JWT here and
 * taking the owner from its `sub` instead of from the header; nothing else on the server would
 * change, because every resolver reads the owner from `@CurrentUser()` and never from client
 * input. Real authentication is out of scope, so the header lookup must not grow into one.
 */

/** The header the client sends: `x-user-id: <uuid>`. */
const USER_ID_HEADER = "x-user-id";

/**
 * The one error both auth failures use: no header, a repeated header, and an id no user has must
 * be indistinguishable to the client.
 */
export const NOT_AUTHENTICATED_MESSAGE =
  "Not authenticated: send a valid x-user-id header naming an existing user";

/**
 * The GraphQL context, produced by `createGqlContext` and shared by `CurrentUserGuard` and
 * `@CurrentUser()`.
 */
export interface GqlContext {
  /** The raw header value; `undefined` when the client sent none. */
  userId: string | undefined;
  /** The `User` behind `userId`, attached by `CurrentUserGuard`; `undefined` before it runs. */
  user: User | undefined;
}

/**
 * The part of the HTTP request the context factory reads. Structural, because the only thing
 * needed is the header bag — no `@types/express` in this package.
 */
export interface GqlContextArgument {
  readonly req: { readonly headers: IncomingHttpHeaders };
}

/**
 * `GraphQLModule.forRoot({ context })`: turns the request into the context the guard and
 * `@CurrentUser()` read.
 *
 * A duplicated header arrives as an array and is treated as absent: one request must not be able
 * to claim two identities. Whether the id names a user is the guard's question, so both failures
 * end in the same error.
 */
export function createGqlContext({ req }: GqlContextArgument): GqlContext {
  const header = req.headers[USER_ID_HEADER];

  return {
    userId: typeof header === "string" && header.length > 0 ? header : undefined,
    user: undefined,
  };
}
