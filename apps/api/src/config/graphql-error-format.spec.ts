import { describe, expect, it } from "@jest/globals";
import { HttpStatus } from "@nestjs/common";
import type { GraphQLFormattedError } from "graphql";
import { formatGraphqlError } from "./graphql-error-format";

/**
 * The formatter's two rewrites, exercised on the function alone: it takes `isProduction` as a
 * parameter and never imports `./env`, so this suite runs without a `DATABASE_URL`, a
 * `WEB_ORIGIN`, a Nest bootstrap or a database. Every assertion is on the error the client would
 * receive, which is the contract.
 */

const NOT_FOUND_MESSAGE = "Bottle not found";

/** The shape the driver hands over after its own 404 handling: a code *and* an HTTP status. */
function notFoundError(): GraphQLFormattedError {
  return {
    message: NOT_FOUND_MESSAGE,
    extensions: { code: "INTERNAL_SERVER_ERROR", status: HttpStatus.NOT_FOUND },
  };
}

/**
 * The shape a MikroORM/pg failure arrives in: `INTERNAL_SERVER_ERROR`, a raw driver message and the
 * extra extensions the driver fills in.
 */
function internalError(): GraphQLFormattedError {
  return {
    message: 'select * from "bottle" where "owner_id" = $1 - column "owner" does not exist',
    extensions: {
      code: "INTERNAL_SERVER_ERROR",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      originalError: { message: 'column "owner" does not exist' },
    },
  };
}

describe("formatGraphqlError", () => {
  it("renames a 404 to NOT_FOUND and keeps the message", () => {
    const error = notFoundError();

    const result = formatGraphqlError(error, new Error(NOT_FOUND_MESSAGE), true);

    // The client detects the code, so a missing bottle must not read as a server failure.
    expect(result.message).toBe(NOT_FOUND_MESSAGE);
    expect(result.extensions).toEqual({ code: "NOT_FOUND", status: HttpStatus.NOT_FOUND });
  });

  it("redacts an internal server error to a neutral message in production", () => {
    const result = formatGraphqlError(internalError(), new Error("driver failure"), true);

    expect(result.message).toBe("Internal server error");
    // Nothing else survives: `status` and `originalError` would carry the raw message back.
    expect(result.extensions).toEqual({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("keeps the message and the extensions of an internal error outside production", () => {
    const error = internalError();

    const result = formatGraphqlError(error, new Error("driver failure"), false);

    expect(result.message).toBe(error.message);
    expect(result.extensions).toEqual(error.extensions);
  });

  it("leaves a validation error untouched in production", () => {
    const error: GraphQLFormattedError = {
      message: "Enter the bottle name",
      extensions: { code: "BAD_USER_INPUT", status: HttpStatus.BAD_REQUEST },
    };

    const result = formatGraphqlError(error, error, true);

    expect(result.message).toBe("Enter the bottle name");
    expect(result.extensions).toEqual({ code: "BAD_USER_INPUT", status: HttpStatus.BAD_REQUEST });
  });
});
