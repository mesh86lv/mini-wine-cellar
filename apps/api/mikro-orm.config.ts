import { defineConfig, type EntityManager } from "@mikro-orm/postgresql";
import { env } from "./src/config/env";

/**
 * The single ORM configuration, shared by the MikroORM CLI and `MikroOrmModule.forRoot`.
 * The schema is created by migrations only: `schema.update()` and `ensureDatabase` stay off.
 *
 * Paths are relative to `apps/api` (`process.cwd()`), the package root. `tsconfig.json` sets
 * `rootDir: "."`, so compiled sources land under `dist/src/...` — hence `path` below.
 *
 * `defineConfig` is given its `EntityManager` generic explicitly: the globs below infer `string[]`
 * as the config's `Entities` type, which would reject entity classes passed in place of a glob
 * — the seed does that, because `dist/` does not exist when it runs from `src/` via tsx.
 */
const mikroOrmConfig = defineConfig<EntityManager>({
  clientUrl: env.DATABASE_URL,
  entities: ["dist/**/*.entity.js"],
  entitiesTs: ["src/**/*.entity.ts"],
  migrations: {
    path: "dist/src/migrations",
    pathTs: "src/migrations",
  },
  allowGlobalContext: false,
  // With no entity file in the tree the globs above discover nothing and MikroORM aborts with
  // "No entities were discovered", so the check is off instead of depending on that.
  discovery: { warnWhenNoEntities: false },
});

export default mikroOrmConfig;
