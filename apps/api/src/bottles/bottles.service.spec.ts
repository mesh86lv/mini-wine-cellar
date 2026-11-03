import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  EntityManager,
  type FilterQuery,
  type FindOneOrFailOptions,
  type FindOptions,
  isRaw,
  QueryOrder,
} from "@mikro-orm/core";
import { NotFoundException } from "@nestjs/common";
import { User } from "../users/user.entity";
import { Bottle } from "./bottle.entity";
import { BottlesService } from "./bottles.service";
import type { AddBottleInput } from "./dto/add-bottle.input";

/**
 * The service's four backend behaviours, without a database: the `EntityManager` is a hand-rolled
 * double of typed `jest.fn()`s, and every assertion is on the **arguments** the service passes.
 * The arguments are the behaviour — the SQL those arguments become is Postgres' job and is
 * verified manually against the compose database.
 */

const OWNER_ID = "0f8a1c2b-3d4e-4f50-8a1b-2c3d4e5f6a70";
const STRANGER_ID = "1a2b3c4d-5e6f-4a7b-9c8d-0e1f2a3b4c5d";
const OWNER_BOTTLE_ID = "2b3c4d5e-6f70-4b81-8c9d-1e2f3a4b5c6d";
const STRANGER_BOTTLE_ID = "3c4d5e6f-7081-4c92-9d0e-2f3a4b5c6d7e";
const UNKNOWN_BOTTLE_ID = "4d5e6f70-8192-4da3-8e1f-3a4b5c6d7e8f";

const NOT_FOUND_MESSAGE = "Bottle not found";

/**
 * The `EntityManager` signatures the double reproduces, written out instead of derived from the
 * interface: the arguments the service passes are the behaviour under test, so each one is named
 * here (Jest 30 types a mock over the whole function type, not over a return/arguments pair).
 */
type FindBottles = (
  entity: typeof Bottle,
  where: FilterQuery<Bottle>,
  options: FindOptions<Bottle>,
) => Promise<Bottle[]>;
type CreateBottle = (entity: typeof Bottle, data: Record<string, unknown>) => Bottle;
type FlushChanges = () => Promise<void>;
type UpdateBottle = (
  entity: typeof Bottle,
  where: FilterQuery<Bottle>,
  data: Record<string, unknown>,
) => Promise<number>;
type ReadBackBottle = (
  entity: typeof Bottle,
  where: FilterQuery<Bottle>,
  options: FindOneOrFailOptions<Bottle>,
) => Promise<Bottle>;

/**
 * Exactly the `EntityManager` members `BottlesService` uses (one `em`, no repositories):
 * `find`, `create`, `flush`, `nativeUpdate`, `findOneOrFail`. Note `flush`, not MikroORM 6's
 * removed `persistAndFlush` — the double follows the committed code, not the older recipe.
 *
 * The data/where payloads are `Record<string, unknown>` on purpose: the double records what the
 * service sends, and the assertions below inspect it instead of claiming to know its shape.
 */
function createEntityManagerDouble() {
  return {
    find: jest.fn<FindBottles>(),
    create: jest.fn<CreateBottle>(),
    flush: jest.fn<FlushChanges>(),
    nativeUpdate: jest.fn<UpdateBottle>(),
    findOneOrFail: jest.fn<ReadBackBottle>(),
  };
}

type EntityManagerDouble = ReturnType<typeof createEntityManagerDouble>;

function createService(em: EntityManagerDouble): BottlesService {
  // The double implements only what the service calls, so it is not an `EntityManager`; this
  // single assertion is that seam and the only place the test leaves the types.
  return new BottlesService(em as unknown as EntityManager);
}

/** The one call a double received, typed — "exactly once" is part of every claim here. */
function onlyCall<T, Args extends unknown[]>(mock: jest.Mock<(...args: Args) => T>): Args {
  expect(mock.mock.calls).toHaveLength(1);

  const call = mock.mock.calls[0];

  if (call === undefined) {
    throw new Error("expected the EntityManager double to have been called exactly once");
  }

  return call;
}

function userFixture(id: string, name: string): User {
  const user = new User();
  user.id = id;
  user.name = name;

  return user;
}

function bottleFixture(owner: User, name: string): Bottle {
  const bottle = new Bottle();
  bottle.owner = owner;
  bottle.name = name;
  bottle.producer = "Cantina Sociale";
  bottle.vintage = 2016;
  bottle.region = "Piedmont";

  return bottle;
}

function addBottleInput(): AddBottleInput {
  return {
    name: "Barolo Riserva",
    producer: "Cantina Sociale",
    vintage: 2016,
    region: "Piedmont",
    photoUrl: "https://example.com/barolo.jpg",
  };
}

describe("BottlesService", () => {
  let em: EntityManagerDouble;
  let service: BottlesService;
  let owner: User;
  let stranger: User;

  beforeEach(() => {
    em = createEntityManagerDouble();
    service = createService(em);
    owner = userFixture(OWNER_ID, "Alice");
    stranger = userFixture(STRANGER_ID, "Bob");
  });

  it("adds a bottle owned by the user the guard resolved, with likesCount 0", async () => {
    const created = bottleFixture(owner, "Barolo Riserva");
    em.create.mockReturnValue(created);
    em.flush.mockResolvedValue(undefined);

    // A payload that tries to smuggle in its own owner must lose to the passed `User`.
    const input = Object.assign(addBottleInput(), { owner: stranger });

    const result = await service.add(owner, input);

    expect(result).toBe(created);

    const [entityName, data] = onlyCall(em.create);
    expect(entityName).toBe(Bottle);
    expect(data.owner).toBe(owner);
    expect(data.likesCount).toBe(0);
    expect(data.name).toBe("Barolo Riserva");
    expect(data.photoUrl).toBe("https://example.com/barolo.jpg");

    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("lists only the caller's bottles, newest first with id as the tie-breaker", async () => {
    const bottles = [bottleFixture(owner, "Barolo"), bottleFixture(owner, "Barbaresco")];
    em.find.mockResolvedValue(bottles);

    const result = await service.listForUser(OWNER_ID);

    expect(result).toBe(bottles);

    const [entityName, where, options] = onlyCall(em.find);
    expect(entityName).toBe(Bottle);
    expect(where).toEqual({ owner: OWNER_ID });
    expect(options).toEqual({ orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC } });
  });

  it("likes an own bottle with a single owner-scoped atomic update and reads it back refreshed", async () => {
    const readBack = bottleFixture(owner, "Barolo");
    readBack.likesCount = 1;
    em.nativeUpdate.mockResolvedValue(1);
    em.findOneOrFail.mockResolvedValue(readBack);

    const result = await service.like(OWNER_ID, OWNER_BOTTLE_ID);

    expect(result).toBe(readBack);

    const [entityName, where, data] = onlyCall(em.nativeUpdate);
    expect(entityName).toBe(Bottle);
    // One statement, owner in the `WHERE`: no read-modify-write window and no second query.
    expect(where).toEqual({ id: OWNER_BOTTLE_ID, owner: OWNER_ID });
    expect(isRaw(data.likesCount)).toBe(true);
    expect(data.likesCount).toMatchObject({ sql: "likes_count + 1", params: [] });

    const [readEntityName, readWhere, readOptions] = onlyCall(em.findOneOrFail);
    expect(readEntityName).toBe(Bottle);
    expect(readWhere).toEqual({ id: OWNER_BOTTLE_ID });
    // `nativeUpdate` leaves the identity map alone, so the answer must be re-read.
    expect(readOptions).toEqual({ refresh: true });

    // Nothing outside that write and that read-back touched the database.
    expect(em.find).not.toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("answers a non-UUID bottle id as not found without touching the database", async () => {
    // A non-UUID cannot match a row, and PostgreSQL would fail the `uuid` cast with a 500.
    const outcome = await service.like(OWNER_ID, "not-a-uuid").then(
      (bottle) => bottle,
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(NotFoundException);
    expect(outcome).toMatchObject({ message: NOT_FOUND_MESSAGE });

    // The guard runs before any statement, so the double was never reached at all.
    expect(em.nativeUpdate).not.toHaveBeenCalled();
    expect(em.findOneOrFail).not.toHaveBeenCalled();
    expect(em.find).not.toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("throws NotFoundException for a foreign or unknown bottle and hands back no bottle", async () => {
    // `nativeUpdate` changed no row: the bottle is someone else's, or there is no such bottle.
    em.nativeUpdate.mockResolvedValue(0);

    for (const bottleId of [STRANGER_BOTTLE_ID, UNKNOWN_BOTTLE_ID]) {
      // The fulfilled channel is captured too: a bottle reaching the caller fails this assertion.
      const outcome = await service.like(OWNER_ID, bottleId).then(
        (bottle) => bottle,
        (error: unknown) => error,
      );

      expect(outcome).toBeInstanceOf(NotFoundException);
      expect(outcome).toMatchObject({ message: NOT_FOUND_MESSAGE });
    }

    // Both ids were probed with the same owner-scoped statement, so the client cannot learn which.
    expect(em.nativeUpdate.mock.calls.map(([, where]) => where)).toEqual([
      { id: STRANGER_BOTTLE_ID, owner: OWNER_ID },
      { id: UNKNOWN_BOTTLE_ID, owner: OWNER_ID },
    ]);

    // Nothing was read back to disguise the failure.
    expect(em.findOneOrFail).not.toHaveBeenCalled();
    expect(em.find).not.toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
  });
});
