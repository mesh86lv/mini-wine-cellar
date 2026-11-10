import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * The schema is read from the committed `apps/api/schema.gql` file, never from a running server, so
 * `pnpm codegen` works on a clean clone. The output under `src/gql` is committed as well; a stale
 * checkout is caught by `pnpm codegen && git diff --exit-code apps/web/src/gql`.
 */
const config: CodegenConfig = {
  schema: "../api/schema.gql",
  documents: ["src/**/*.{ts,tsx}", "src/**/*.graphql"],
  ignoreNoDocuments: false,
  generates: {
    "src/gql/": {
      preset: "client",
      presetConfig: {
        // Only the documents this app actually queries are useful here; the whole-schema types of
        // `fragmentMasking` only add noise for a client that owns the API.
        fragmentMasking: false,
      },
      config: {
        // `TypedDocumentNode` arrives as a type-only import, so nothing from `graphql` or the
        // preset has to exist at runtime in the client bundle.
        useTypeImports: true,
        // GraphQL enums become string unions instead of `const enum`-like objects.
        enumsAsTypes: true,
        // Every selection gets `__typename`, which the Apollo cache needs to identify records.
        nonOptionalTypename: true,
        avoidOptionals: {
          field: true,
          inputValue: false,
        },
        strictScalars: true,
        scalars: {
          DateTime: "string",
        },
      },
    },
  },
};

export default config;
