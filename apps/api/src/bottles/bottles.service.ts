import { EntityManager, QueryOrder } from "@mikro-orm/core";
import { raw } from "@mikro-orm/postgresql";
import { Injectable, NotFoundException } from "@nestjs/common";
import { isUUID } from "class-validator";
import type { User } from "../users/user.entity";
import { Bottle } from "./bottle.entity";
import type { AddBottleInput } from "./dto/add-bottle.input";

/** The answer for both "no such bottle" and "not yours" — the client must not learn which. */
const BOTTLE_NOT_FOUND_MESSAGE = "Bottle not found";

/**
 * All bottle logic. Ownership arrives as the `User` the guard resolved, never as
 * something the client sent.
 */
@Injectable()
export class BottlesService {
  constructor(private readonly em: EntityManager) {}

  /**
   * `WHERE owner_id = ? ORDER BY created_at DESC, id DESC` — the shape of the
   * `(owner_id, created_at DESC)` index, newest first. `id` breaks ties so two
   * bottles added in the same millisecond keep a stable order. `owner` is not populated: it is
   * not part of the response and would cost a second query.
   */
  listForUser(userId: string): Promise<Bottle[]> {
    return this.em.find(
      Bottle,
      { owner: userId },
      { orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC } },
    );
  }

  /**
   * `add` takes the guard's `User` rather than only its id, so the relation is set from an entity
   * that is already managed — no second lookup to build a reference. `likesCount` starts at 0
   * that is already managed — no second lookup to build a reference. `likesCount` starts at 0;
   */
  async add(user: User, input: AddBottleInput): Promise<Bottle> {
    const bottle = this.em.create(Bottle, {
      owner: user,
      name: input.name,
      producer: input.producer,
      vintage: input.vintage,
      region: input.region,
      photoUrl: input.photoUrl ?? null,
      likesCount: 0,
    });

    await this.em.flush();

    return bottle;
  }

  /**
   * The atomic like: one `UPDATE ... SET likes_count = likes_count + 1 WHERE id = ? AND
   * owner_id = ?`.
   *
   * The owner is part of the statement, not a check in front of it: there is no read-modify-write
   * window to lose a concurrent increment in, no extra query, and no way for the answer to tell a
   * foreign bottle from a missing one. `nativeUpdate` counts the rows it changed, and 0 means the
   * bottle does not exist or belongs to someone else.
   *
   * An id that is not a UUID cannot match a row, and passing it to PostgreSQL would fail the
   * `uuid` cast with a 500; it is answered as "not found" for the same reason.
   */
  async like(userId: string, bottleId: string): Promise<Bottle> {
    if (!isUUID(bottleId)) {
      throw new NotFoundException(BOTTLE_NOT_FOUND_MESSAGE);
    }

    const affectedRows = await this.em.nativeUpdate(
      Bottle,
      { id: bottleId, owner: userId },
      { likesCount: raw("likes_count + 1") },
    );

    if (affectedRows === 0) {
      throw new NotFoundException(BOTTLE_NOT_FOUND_MESSAGE);
    }

    // `nativeUpdate` leaves the identity map alone, so a plain `findOne` could return the value
    // from before the update; `refresh: true` reads the committed row back.
    return this.em.findOneOrFail(Bottle, { id: bottleId }, { refresh: true });
  }
}
