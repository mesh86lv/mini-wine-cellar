import { Field, ID, ObjectType } from "@nestjs/graphql";

/**
 * The public `User` — what the `users` query returns to feed the fake-login dropdown.
 *
 * Kept apart from the `User` entity so the entity's `createdAt` never reaches the wire: the
 * public type exposes exactly `id` and `name`.
 */
@ObjectType("User")
export class UserModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}
