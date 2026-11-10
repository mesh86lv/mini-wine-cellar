import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { UsersService } from "../users/users.service";
import { type GqlContext, NOT_AUTHENTICATED_MESSAGE } from "./gql-context";

/**
 * Resolves the caller of a protected operation and attaches the `User` to the GraphQL context.
 * Applied per operation, so the public `users` query stays open.
 *
 * A missing header and an id no user has both end in `UnauthorizedException`; `@nestjs/apollo`
 * maps it to `extensions.code = "UNAUTHENTICATED"` inside an HTTP 200 body, and that code — not
 * a 401 status — is what the client detects.
 */
@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context).getContext<GqlContext>();
    const user =
      gqlContext.userId === undefined ? null : await this.usersService.findById(gqlContext.userId);

    if (user === null) {
      throw new UnauthorizedException(NOT_AUTHENTICATED_MESSAGE);
    }

    gqlContext.user = user;

    return true;
  }
}
