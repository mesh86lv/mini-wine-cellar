import { randomUUID } from "node:crypto";
import { OptionalProps } from "@mikro-orm/core";
import {
  Check,
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";
import { User } from "../users/user.entity";

/**
 * A bottle in someone's cellar.
 *
 * Every decorator states its `type`/`entity` explicitly so the metadata never depends on
 * reflection and survives any TypeScript or Jest transform.
 */
@Entity({ tableName: "bottle" })
@Check({ name: "bottle_likes_count_check", expression: "likes_count >= 0" })
// The access path of `myBottles`: `WHERE owner_id = ? ORDER BY created_at DESC, id DESC`.
@Index({
  name: "bottle_owner_created_at_index",
  columns: [{ name: "owner" }, { name: "createdAt", sort: "DESC" }],
})
export class Bottle {
  /** `likesCount` and `createdAt` carry DB/framework defaults, so `em.create()` may omit them. */
  [OptionalProps]?: "likesCount" | "createdAt";

  @PrimaryKey({ type: "uuid" })
  id: string = randomUUID();

  @ManyToOne({ entity: () => User, type: "uuid", deleteRule: "cascade" })
  owner!: User;

  @Property({ type: "string", length: 120 })
  name!: string;

  @Property({ type: "string", length: 120 })
  producer!: string;

  @Property({ type: "integer" })
  vintage!: number;

  @Property({ type: "string", length: 120 })
  region!: string;

  @Property({ type: "string", length: 2048, nullable: true })
  photoUrl: string | null = null;

  @Property({ type: "integer", default: 0 })
  likesCount: number = 0;

  /**
   * `defaultRaw` puts `now()` in the DDL; `onCreate` fills the value before the flush, so a
   * freshly constructed `Bottle` is never missing it.
   */
  @Property({
    type: "datetime",
    columnType: "timestamptz",
    defaultRaw: "now()",
    onCreate: () => new Date(),
  })
  createdAt: Date = new Date();
}
