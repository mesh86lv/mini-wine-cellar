/*
 * `apps/web/tsconfig.json` sets no `types` list, and the automatic `@types` scan does not see the
 * pnpm-symlinked `@types/jest`, so this file asks for the jest globals itself — the same thing the
 * API package does project-wide with `"types": ["node", "jest"]`.
 */
/// <reference types="jest" />

import { type BottleFormValues, bottleFormSchema, toAddBottleInput } from "@/lib/schemas/bottle";

/**
 * The form schema, case by case. Every assertion is on the exact wording and not on "validation
 * failed": the sentence the user reads is part of the contract, and the client has to say what the
 * API's DTO would have said for the same input.
 *
 * The current year is read inside the vintage case, at run time, so the suite keeps accepting the
 * newest vintage after New Year's Eve instead of turning red every January.
 */
const PHOTO_URL_MESSAGE = "Enter a valid URL starting with http:// or https://";

/** A complete, valid form: each case below overrides one field and leaves the rest untouched. */
const VALID_VALUES: BottleFormValues = {
  name: "Barolo Riserva",
  producer: "Giacomo Conterno",
  vintage: "2019",
  region: "Piedmont",
  photoUrl: "",
};

interface Issue {
  path: string;
  message: string;
}

/**
 * Every issue the schema reports for one form, as `path` + `message`. Asserting the whole array
 * proves both which fields are flagged and what each of them says — a missing field cannot hide
 * behind a correct message on another one.
 */
function issuesFor(overrides: Partial<BottleFormValues>): Issue[] {
  const result = bottleFormSchema.safeParse({ ...VALID_VALUES, ...overrides });

  if (result.success) {
    throw new Error(`Expected validation to fail for ${JSON.stringify(overrides)}`);
  }

  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** True when the whole schema accepts `photoUrl` — the predicate alone is not what a user meets. */
function acceptsPhotoUrl(photoUrl: string): boolean {
  return bottleFormSchema.safeParse({ ...VALID_VALUES, photoUrl }).success;
}

describe("bottleFormSchema", () => {
  it("accepts a complete bottle and keeps the photo URL optional", () => {
    const result = bottleFormSchema.safeParse(VALID_VALUES);

    if (!result.success) {
      throw new Error(`Expected valid input, got ${JSON.stringify(result.error.issues)}`);
    }

    expect(result.data).toStrictEqual(VALID_VALUES);

    // An empty field reaches the mutation as "no photo", not as an empty string.
    expect(toAddBottleInput(result.data)).toStrictEqual({
      name: "Barolo Riserva",
      producer: "Giacomo Conterno",
      vintage: 2019,
      region: "Piedmont",
      photoUrl: undefined,
    });

    const withPhoto = bottleFormSchema.safeParse({
      ...VALID_VALUES,
      photoUrl: "https://example.com/barolo.png",
    });

    if (!withPhoto.success) {
      throw new Error(`Expected a valid photo URL, got ${JSON.stringify(withPhoto.error.issues)}`);
    }

    expect(toAddBottleInput(withPhoto.data).photoUrl).toBe("https://example.com/barolo.png");
  });

  it("reports the message for each missing required field", () => {
    expect(issuesFor({ name: "", producer: "", vintage: "", region: "" })).toEqual([
      { path: "name", message: "Enter the bottle name" },
      { path: "producer", message: "Enter the producer" },
      { path: "vintage", message: "Enter a vintage year" },
      { path: "region", message: "Enter the region" },
    ]);

    // The values are trimmed first, so whitespace counts as "nothing entered".
    expect(issuesFor({ name: "   ", region: "\t" })).toEqual([
      { path: "name", message: "Enter the bottle name" },
      { path: "region", message: "Enter the region" },
    ]);
  });

  it("rejects an out-of-range vintage with the range message and an empty one with the hint", () => {
    const currentYear = new Date().getFullYear();
    const rangeMessage = `Vintage must be a year between 1900 and ${currentYear}`;
    const accepts = (vintage: string): boolean =>
      bottleFormSchema.safeParse({ ...VALID_VALUES, vintage }).success;
    const messagesFor = (vintage: string): string[] =>
      issuesFor({ vintage }).map((issue) => issue.message);

    expect([
      messagesFor("1899"),
      messagesFor(String(currentYear + 1)),
      messagesFor("abcd"),
      messagesFor("20x4"),
      messagesFor("0001"),
    ]).toEqual([[rangeMessage], [rangeMessage], [rangeMessage], [rangeMessage], [rangeMessage]]);

    // "Enter a vintage year" is for the empty field only, never for a malformed year.
    expect(messagesFor("")).toEqual(["Enter a vintage year"]);

    // Both ends of the range are accepted, so the message cannot drift away from the rule.
    expect(accepts("1900")).toBe(true);
    expect(accepts(String(currentYear))).toBe(true);
  });

  it("rejects a javascript: and an ftp: photo URL with the URL message", () => {
    // The case a plain `z.string().url()` would silently pass: both strings are syntactically URLs.
    expect([
      issuesFor({ photoUrl: "javascript:alert(1)" }),
      issuesFor({ photoUrl: "ftp://example.com/barolo.png" }),
      // No host: the server's `@IsUrl` rejects it, and `new URL()` refuses it here for the same
      // reason, so the client does not offer a value the API would bounce.
      issuesFor({ photoUrl: "https://" }),
    ]).toEqual([
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
    ]);
  });

  it("refuses the same photo-URL hosts the API refuses, and accepts the ones it takes", () => {
    // All four are refused by the API with the message below, so the client refuses them itself
    // rather than offering them. Three fail the FQDN rule: `isFQDN` under `require_tld: true`
    // rejects the missing dot (localhost), the underscore and the one-letter TLD.
    // `example.123` never reaches that rule — `new URL()` refuses it first, because the WHATWG
    // parser reads a numeric last label as an IPv4 address.
    expect([
      issuesFor({ photoUrl: "http://localhost:3000/barolo.png" }),
      issuesFor({ photoUrl: "http://my_wine.com/barolo.png" }),
      issuesFor({ photoUrl: "http://example.123/barolo.png" }),
      issuesFor({ photoUrl: "http://example.c/barolo.png" }),
    ]).toEqual([
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
    ]);

    // The two rules the wide label class admits and `isFQDN` still refuses: a hyphen at either
    // edge of a label (`isFQDN.js:66`) and a full-width form in U+FF01–U+FF5E (`isFQDN.js:61`). The
    // full-width case is the one only the raw host catches: `new URL()` folds `\uff4c` into `l`,
    // so the normalized hostname is a plain `example.com` the server never gets to see.
    expect([
      issuesFor({ photoUrl: "http://example-.com/barolo.png" }),
      issuesFor({ photoUrl: "http://-example.com/barolo.png" }),
      issuesFor({ photoUrl: "http://examp\uff4ce.com/barolo.png" }),
    ]).toEqual([
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
      [{ path: "photoUrl", message: PHOTO_URL_MESSAGE }],
    ]);

    // The other direction matters as much: the stricter host rule must not reject a host the
    // server accepts — a plain FQDN, and both IP literals `@IsUrl` takes through `isIP`: IPv4, and
    // an IPv6 one in brackets.
    expect([
      acceptsPhotoUrl("https://example.com/x.png"),
      acceptsPhotoUrl("http://127.0.0.1/x.png"),
      acceptsPhotoUrl("http://[::1]:8080/x.png"),
    ]).toEqual([true, true, true]);
  });

  it("rejects the port 0 and keeps a legitimate one, exactly as isURL does", () => {
    // `isURL.js:227` refuses a port outside 1–65535 while `new URL()` lets `0` through, so this is
    // the one port the parser accepts and the API bounces.
    expect(issuesFor({ photoUrl: "https://example.com:0/x.png" })).toEqual([
      { path: "photoUrl", message: PHOTO_URL_MESSAGE },
    ]);

    // The other direction: a port the server accepts must survive the stricter client rule.
    expect(acceptsPhotoUrl("https://example.com:8443/x.png")).toBe(true);
  });

  it("reports the message for each field that exceeds 120 characters", () => {
    const tooLong = "a".repeat(121);

    expect(issuesFor({ name: tooLong })).toEqual([
      { path: "name", message: "Name must be at most 120 characters" },
    ]);
    expect(issuesFor({ producer: tooLong })).toEqual([
      { path: "producer", message: "Producer must be at most 120 characters" },
    ]);
    expect(issuesFor({ region: tooLong })).toEqual([
      { path: "region", message: "Region must be at most 120 characters" },
    ]);

    // 120 is the bound the messages name, so the boundary itself has to be accepted.
    expect(bottleFormSchema.safeParse({ ...VALID_VALUES, name: "a".repeat(120) }).success).toBe(
      true,
    );
  });

  it("accepts a 2048-character photo URL and rejects a 2049-character one", () => {
    const prefix = "https://example.com/";
    const longest = prefix + "a".repeat(2048 - prefix.length);

    expect(longest).toHaveLength(2048);
    expect(bottleFormSchema.safeParse({ ...VALID_VALUES, photoUrl: longest }).success).toBe(true);

    const tooLong = `${longest}a`;

    expect(tooLong).toHaveLength(2049);
    expect(issuesFor({ photoUrl: tooLong })).toEqual([
      { path: "photoUrl", message: PHOTO_URL_MESSAGE },
    ]);
  });
});
