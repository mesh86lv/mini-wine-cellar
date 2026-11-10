import { MikroORM } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
import mikroOrmConfig from "../../mikro-orm.config";
import { Bottle } from "../bottles/bottle.entity";
import { User } from "../users/user.entity";

/**
 * Idempotent demo data: a second run must change nothing, so every row is looked up by a
 * fixed UUID before it is created. The seed, not the migration, owns this data.
 */

interface DemoUser {
  readonly id: string;
  readonly name: string;
}

interface DemoBottle {
  readonly id: string;
  readonly name: string;
  readonly producer: string;
  readonly vintage: number;
  readonly region: string;
  readonly photoUrl: string | null;
}

const ALICE: DemoUser = { id: "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1001", name: "Alice" };
const BOB: DemoUser = { id: "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1002", name: "Bob" };
const CAROL: DemoUser = { id: "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a1003", name: "Carol" };

const DEMO_USERS: readonly DemoUser[] = [ALICE, BOB, CAROL];

/** Alice owns the bottles, so the first `myBottles` of the demo is not empty. */
const DEMO_BOTTLES: readonly DemoBottle[] = [
  {
    id: "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a2001",
    name: "Château Margaux",
    producer: "Château Margaux",
    vintage: 2015,
    region: "Margaux, Bordeaux",
    photoUrl: null,
  },
  {
    id: "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a2002",
    name: "Barolo Riserva",
    producer: "Giacomo Conterno",
    vintage: 2016,
    region: "Piedmont",
    photoUrl: null,
  },
  {
    id: "0f1a8b1e-3c1d-4f11-9a6a-0b1e7f2a2003",
    name: "Riesling Kabinett",
    producer: "Dr. Loosen",
    vintage: 2019,
    region: "Mosel",
    photoUrl: "https://images.example.com/riesling-kabinett.jpg",
  },
];

const logger = new Logger("Seed");

async function seed(): Promise<void> {
  // Discovery takes `entitiesTs` over `entities` whenever TypeScript is in play, and the
  // shared config's `entities` glob only resolves against `dist/`, which does not exist while the
  // seed runs from `src/` via tsx. Passing the classes explicitly and emptying `entitiesTs` makes
  // them the only discovery source: no build step, no dependency on the working directory.
  const orm = await MikroORM.init({ ...mikroOrmConfig, entities: [User, Bottle], entitiesTs: [] });

  try {
    const em = orm.em.fork();
    let usersCreated = 0;
    let usersSkipped = 0;
    let bottlesCreated = 0;
    let bottlesSkipped = 0;

    for (const demoUser of DEMO_USERS) {
      const existing = await em.findOne(User, { id: demoUser.id });

      if (existing !== null) {
        usersSkipped += 1;
        continue;
      }

      em.create(User, { id: demoUser.id, name: demoUser.name });
      usersCreated += 1;
    }

    for (const demoBottle of DEMO_BOTTLES) {
      const existing = await em.findOne(Bottle, { id: demoBottle.id });

      if (existing !== null) {
        bottlesSkipped += 1;
        continue;
      }

      em.create(Bottle, {
        id: demoBottle.id,
        owner: em.getReference(User, ALICE.id),
        name: demoBottle.name,
        producer: demoBottle.producer,
        vintage: demoBottle.vintage,
        region: demoBottle.region,
        photoUrl: demoBottle.photoUrl,
      });
      bottlesCreated += 1;
    }

    await em.flush();

    logger.log(`users: ${usersCreated} created, ${usersSkipped} skipped`);
    logger.log(`bottles: ${bottlesCreated} created, ${bottlesSkipped} skipped`);
  } finally {
    await orm.close(true);
  }
}

seed().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error), undefined, "Seed");
  process.exitCode = 1;
});
