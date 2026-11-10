import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentUserGuard } from "../auth/current-user.guard";
import type { User } from "../users/user.entity";
import type { Bottle } from "./bottle.entity";
import { BottleModel } from "./bottle.model";
import { BottlesService } from "./bottles.service";
import { AddBottleInput } from "./dto/add-bottle.input";

/**
 * Thin wiring only: each operation takes the owner from `@CurrentUser()` and hands the
 * work to the service. The entities it returns carry exactly the fields `BottleModel` exposes.
 */
@Resolver(() => BottleModel)
export class BottlesResolver {
  constructor(private readonly bottlesService: BottlesService) {}

  @Query(() => [BottleModel], { description: "The current user's bottles, newest first." })
  @UseGuards(CurrentUserGuard)
  myBottles(@CurrentUser() user: User): Promise<Bottle[]> {
    return this.bottlesService.listForUser(user.id);
  }

  @Mutation(() => BottleModel, { description: "Adds a bottle to the current user's cellar." })
  @UseGuards(CurrentUserGuard)
  addBottle(
    @CurrentUser() user: User,
    @Args("input", { type: () => AddBottleInput }) input: AddBottleInput,
  ): Promise<Bottle> {
    return this.bottlesService.add(user, input);
  }

  @Mutation(() => BottleModel, {
    description: "Increments the like counter of one of the current user's bottles.",
  })
  @UseGuards(CurrentUserGuard)
  likeBottle(
    @CurrentUser() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Bottle> {
    return this.bottlesService.like(user.id, id);
  }
}
