import { Query, Resolver } from "@nestjs/graphql";
import type { User } from "./user.entity";
import { UserModel } from "./user.model";
import { UsersService } from "./users.service";

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Public on purpose: the fake-login dropdown must be fillable before anyone is signed in.
   * The entities returned here carry the fields `UserModel` exposes and no more.
   */
  @Query(() => [UserModel], { description: "The users available for the fake login." })
  users(): Promise<User[]> {
    return this.usersService.list();
  }
}
