import type { Config } from "jest";

/**
 * Only pure modules are unit tested here (the Zod schema and its helpers), so the default node
 * environment is enough and Next.js is never loaded from a test.
 *
 * `passWithNoTests` is deliberately absent: an empty run has to be red, so a deleted or renamed
 * spec cannot make the root gate green by testing nothing.
 */
const config: Config = {
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.test\\.ts$",
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // The app compiles with `module: esnext` + `moduleResolution: bundler`; Jest runs CommonJS,
        // so the transform overrides only those two options. `node16` keeps the emit CommonJS
        // (`apps/web/package.json` has no `type: module`) and is the oldest pair TypeScript 6 still
        // accepts — `moduleResolution: "node"` is a hard deprecation error there. Strict flags stay
        // inherited.
        tsconfig: { module: "node16", moduleResolution: "node16" },
      },
    ],
  },
};

export default config;
