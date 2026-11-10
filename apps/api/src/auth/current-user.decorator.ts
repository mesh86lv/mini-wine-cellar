import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { User } from "../users/user.entity";
import { type GqlContext, NOT_AUTHENTICATED_MESSAGE } from "./gql-context";

/**
 * The caller of the current operation. Every operation that needs an owner reads it from
 * here — never from the arguments the client controls.
 *
 * Requires `CurrentUserGuard` on the same operation; the guard is what attaches the `User`. A
 * missing user therefore means the decorator and the guard were wired apart, which is a server
 * bug, but it still answers with the auth error instead of handing a resolver an `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const user = GqlExecutionContext.create(context).getContext<GqlContext>().user;

    if (user === undefined) {
      throw new UnauthorizedException(NOT_AUTHENTICATED_MESSAGE);
    }

    return user;
  },
);
