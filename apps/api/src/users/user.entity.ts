import { randomUUID } from "node:crypto";
import { OptionalProps } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

/**
 * A cellar owner. The fake login resolves one of these from `x-user-id`; the
 * entity carries nothing else because real authentication is out of scope.
 *
 * Every decorator states its `type` explicitly so the metadata never depends on reflection
 * and survives any TypeScript or Jest transform.
 */
@Entity({ tableName: "user" })
export class User {
  /** `createdAt` is filled by `onCreate`, so it may be omitted in `em.create()` data. */
  [OptionalProps]?: "createdAt";

  @PrimaryKey({ type: "uuid" })
  id: string = randomUUID();

  @Property({ type: "string", length: 80, unique: true })
  name!: string;

  /**
   * `defaultRaw` puts `now()` in the DDL; `onCreate` fills the value before the flush, so a
   * freshly constructed `User` is never missing it.
   */
  @Property({
    type: "datetime",
    columnType: "timestamptz",
    defaultRaw: "now()",
    onCreate: () => new Date(),
  })
  createdAt: Date = new Date();
}
