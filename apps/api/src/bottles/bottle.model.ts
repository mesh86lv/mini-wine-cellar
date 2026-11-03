import { Field, GraphQLISODateTime, ID, Int, ObjectType } from "@nestjs/graphql";

/**
 * The public `Bottle` — what `myBottles`, `addBottle` and `likeBottle` return.
 *
 * `owner` is deliberately absent: ownership is server-side state, so a client can neither
 * read who owns a bottle nor be tempted to send it back. The class mirrors the exposed entity
 * fields one to one, which is why a resolver can return an entity without a mapping layer.
 */
@ObjectType("Bottle")
export class BottleModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  producer!: string;

  @Field(() => Int)
  vintage!: number;

  @Field(() => String)
  region!: string;

  /** Nullable: the schema's `photoUrl: String`. */
  @Field(() => String, { nullable: true })
  photoUrl!: string | null;

  @Field(() => Int)
  likesCount!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
