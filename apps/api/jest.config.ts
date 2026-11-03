import type { Config } from "jest";

/**
 * The suite runs as real ESM, because the service under test cannot be loaded any other way:
 * `@mikro-orm/core` 7.2.6 is ESM-only (`"type": "module"`, no CJS build in `exports`) and Jest's
 * `require(esm)` shortcut needs Node 24+, while the project targets Node 22. `extensionsToTreatAsEsm`
 * plus ts-jest's `useESM` put spec and source in the ESM pipeline that `--experimental-vm-modules`
 * provides. Jest requires that flag on Node 22; the `test` script in `package.json` passes it.
 *
 * The compiler options override the project's for the transform only: `module` must be an ESM kind
 * to emit `import`, and `moduleResolution: nodenext` cannot be combined with it. They are merged
 * over `tsconfig.json`, so `strict`, `experimentalDecorators` and `types` still apply here, and
 * `pnpm typecheck` keeps checking every file under the project's own `nodenext` settings.
 */
const config: Config = {
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: { module: "esnext", moduleResolution: "bundler" },
        useESM: true,
      },
    ],
  },
};

export default config;
