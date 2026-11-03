import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import mikroOrmConfig from "../mikro-orm.config";
import { createGqlContext } from "./auth/gql-context";
import { BottlesModule } from "./bottles/bottles.module";
import { isProduction } from "./config/env";
import { formatGraphqlError } from "./config/graphql-error-format";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Fake login: the context carries the `x-user-id` header; the guard resolves it.
      context: createGqlContext,
      formatError: (formattedError, thrown) =>
        formatGraphqlError(formattedError, thrown, isProduction),
      // Code-first schema, written to `apps/api/schema.gql` and committed.
      autoSchemaFile: "schema.gql",
      sortSchema: true,
      // `playground: false` keeps the driver from mounting its deprecated GraphQL Playground;
      // the embedded Apollo Sandbox below is the interactive IDE outside production.
      playground: false,
      plugins: isProduction
        ? []
        : [ApolloServerPluginLandingPageLocalDefault({ includeCookies: false })],
      introspection: !isProduction,
      // Apollo's normalizer is the one that attaches `extensions.stacktrace`, and its own default
      // keys off `NODE_ENV` — so the production answer must switch it off here, whatever the
      // deploy sets, instead of stripping the extension afterwards.
      includeStacktraceInErrorResponses: !isProduction,
    }),
    UsersModule,
    BottlesModule,
  ],
})
export class AppModule {}
