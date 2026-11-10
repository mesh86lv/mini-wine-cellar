import { EntityManager, QueryOrder } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { isUUID } from "class-validator";
import { User } from "./user.entity";

/** The only reader of the `user` table: the public `users` query and the auth guard. */
@Injectable()
export class UsersService {
  constructor(private readonly em: EntityManager) {}

  /** The public `users` query: ordered by name, so the dropdown does not reshuffle between calls. */
  list(): Promise<User[]> {
    return this.em.find(User, {}, { orderBy: { name: QueryOrder.ASC } });
  }

  /**
   * Resolves the id the client sent in `x-user-id`.
   *
   * A value that is not a UUID cannot name a user, and handing it to PostgreSQL would fail the
   * `uuid` cast with a 500 instead of the constant "not authenticated" answer the guard owes the
   * client for an unknown id.
   */
  async findById(id: string): Promise<User | null> {
    if (!isUUID(id)) {
      return null;
    }

    return this.em.findOne(User, { id });
  }
}
