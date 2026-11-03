import { z } from "zod";

import type { AddBottleInput } from "@/gql/graphql";

/**
 * One schema for the add-bottle form, with the same messages, word for word, that the API's DTO
 * produces — the user must not be able to tell which side rejected the input.
 *
 * Every value is a string, including `vintage`: the form keeps it in an
 * `<input inputMode="numeric">`, and `toAddBottleInput()` is the single place that converts the
 * validated strings into the generated `AddBottleInput` the mutation sends.
 */

const MAX_TEXT_LENGTH = 120;
const MAX_URL_LENGTH = 2048;
const MIN_VINTAGE_YEAR = 1900;
const VINTAGE_PATTERN = /^\d{4}$/;

const NAME_REQUIRED_MESSAGE = "Enter the bottle name";
const NAME_TOO_LONG_MESSAGE = "Name must be at most 120 characters";
const PRODUCER_REQUIRED_MESSAGE = "Enter the producer";
const PRODUCER_TOO_LONG_MESSAGE = "Producer must be at most 120 characters";
const REGION_REQUIRED_MESSAGE = "Enter the region";
const REGION_TOO_LONG_MESSAGE = "Region must be at most 120 characters";
const VINTAGE_REQUIRED_MESSAGE = "Enter a vintage year";
const PHOTO_URL_MESSAGE = "Enter a valid URL starting with http:// or https://";

/**
 * The upper bound of the vintage range is read when validation runs, never when the module
 * loads — a page opened across New Year's Eve must accept the new year and name it in the message.
 */
function vintageRangeMessage(): string {
  return `Vintage must be a year between ${MIN_VINTAGE_YEAR} and ${new Date().getFullYear()}`;
}

/**
 * `@IsUrl` delegates to validator.js `isURL`, which refuses whitespace and angle brackets anywhere
 * in the string; `new URL()` would percent-encode a space and accept it. Mirrored here so both
 * sides reject the same input.
 */
const URL_FORBIDDEN_CHARACTERS = /[\s<>]/;

/**
 * validator.js `isFQDN` as `@IsUrl` calls it, with its actual defaults — `require_tld: true`,
 * `allow_underscores: false`, `allow_numeric_tld: false`: a label is 1 to 63 characters, drawn from
 * the wide class of `isFQDN.js:56` minus the underscore that class admits and `isFQDN.js:69`
 * refuses.
 */
const HOST_LABEL_PATTERN = /^[a-z\d\u00a1-\uffff]([a-z\d\u00a1-\uffff-]{0,62})?$/i;

/**
 * `isFQDN.js:65-67`: a label may neither start nor end with a hyphen, although the class above
 * allows one in the middle.
 */
const HOST_LABEL_EDGE_HYPHEN_PATTERN = /^-|-$/;

/**
 * `isFQDN.js:60-62`: the full-width forms in U+FF01–U+FF5E are refused even though the label class
 * above admits them, so they need their own exclusion.
 */
const HOST_FULL_WIDTH_PATTERN = /[\uff01-\uff5e]/;

/**
 * validator.js' TLD rule under `require_tld: true`: two or more letters in the wide class the
 * source allows, or a punycode `xn--` label. A numeric TLD (`example.123`) and a one-letter one
 * (`example.c`) are refused.
 */
const TLD_LETTERS = "[a-z\\u00a1-\\u00a8\\u00aa-\\ud7ff\\uf900-\\ufdcf\\ufdf0-\\uffef]";

const TLD_PATTERN = new RegExp(`^(${TLD_LETTERS}{2,}|xn[a-z0-9-]{2,})$`, "i");

/** One octet of an IPv4 literal, exactly as validator.js `isIP` (version 4) accepts it. */
const IPV4_OCTET = "(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])";

const IPV4_ADDRESS_PATTERN = new RegExp(`^(${IPV4_OCTET}\\.){3}${IPV4_OCTET}$`);

/**
 * validator.js reads the host out of the raw string, while `new URL()` rewrites it first: it
 * percent-decodes (`ex%61mple.com` → `example.com`) and applies UTS-46, which folds a full-width
 * label into plain ASCII (`examp\uff4ce.com` → `example.com`). Either rewrite would hide a host
 * `isFQDN` refuses, so the host rule has to read the same characters the server reads. The capture
 * is the host alone: the scheme, the optional `//`, the `user:pass@` auth part if any, and the port
 * are dropped, and a bracketed IPv6 literal keeps its brackets.
 */
const RAW_HOST_PATTERN = /^[a-z][a-z\d+\-.]*:(?:\/\/)?(?:[^/?#@]*@)?(\[[^\]/?#]*\]|[^:/?#]*)/i;

/** The host of `value` exactly as it was typed, or `""` when the string carries no host. */
function rawHostOf(value: string): string {
  return RAW_HOST_PATTERN.exec(value)?.[1] ?? "";
}

/**
 * The host rule the server applies. validator.js `isURL` accepts a host that is an IP literal
 * (`isIP`), an IPv6 one in brackets, or an FQDN; under `require_tld: true` that FQDN needs a dot
 * and a real TLD, which is exactly why the server refuses `http://localhost:3000/p.png` while it
 * accepts `http://127.0.0.1/p.png`. A scheme-only check would have accepted every one of them,
 * so the client would have offered values the API rejects with the same message; this predicate
 * keeps both sides on the same verdict.
 *
 * The full `isFQDN` rule set it mirrors: at least two labels; a label of 1 to 63 characters from
 * the wide class, without an underscore, without a full-width form in U+FF01–U+FF5E and without a
 * hyphen at either edge; and a TLD of two or more letters or an `xn--` label, never a numeric one.
 *
 * `hostname` is the raw host (`rawHostOf`), not `url.hostname`, because the URL parser normalizes
 * the host beyond recognition before it can be read back.
 */
function isAcceptedHost(hostname: string): boolean {
  // `isFQDN.js:61` refuses these characters in any part, and it runs before the IP shortcuts: on
  // `url.hostname` the check would be dead code, because UTS-46 has already folded them away.
  if (HOST_FULL_WIDTH_PATTERN.test(hostname)) {
    return false;
  }

  // A bracketed host is an IPv6 literal the URL parser has already validated.
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return true;
  }

  const labels = hostname.split(".");
  const tld = labels[labels.length - 1];

  // `isIP` runs before `isFQDN` in validator.js, and a URL hostname keeps the dotted form.
  if (IPV4_ADDRESS_PATTERN.test(hostname)) {
    return true;
  }

  return (
    labels.length >= 2 &&
    tld !== undefined &&
    TLD_PATTERN.test(tld) &&
    labels.every(
      (label) => HOST_LABEL_PATTERN.test(label) && !HOST_LABEL_EDGE_HYPHEN_PATTERN.test(label),
    )
  );
}

/**
 * `isURL.js:227` accepts a port only as a decimal number in 1–65535. `new URL()` has already refused
 * the non-numeric form and the values above 65535, so the lower bound is the part left to mirror:
 * `https://example.com:0/x.png` parses on the client, while the API's `@IsUrl` refuses it.
 *
 * An empty port means "the scheme's default", and `isURL` reads that same string as "no port".
 */
function isAcceptedPort(port: string): boolean {
  if (port === "") {
    return true;
  }

  const value = Number(port);

  return value >= 1 && value <= 65535;
}

/**
 * The field is optional, so `""` counts as "not provided" and everything else has to parse as
 * an `http(s)` URL — `z.string().url()` alone would accept `javascript:alert(1)` and `ftp://…`.
 * The port follows `isURL.js:227` as well: an explicit `0` is refused with the same message.
 */
function isHttpUrlOrEmpty(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (URL_FORBIDDEN_CHARACTERS.test(value)) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (!isAcceptedPort(url.port)) {
    return false;
  }

  return isAcceptedHost(rawHostOf(value));
}

/**
 * The vintage rule: a four-digit year from 1900 to the current one. The bound is computed here,
 * at validation time, never when the module loads.
 */
function isVintageYear(value: string): boolean {
  if (!VINTAGE_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value);

  return year >= MIN_VINTAGE_YEAR && year <= new Date().getFullYear();
}

/** Shared by the three text fields: trim first, then "nothing entered" and "too long". */
function requiredText(requiredMessage: string, tooLongMessage: string) {
  return z.string().trim().min(1, requiredMessage).max(MAX_TEXT_LENGTH, tooLongMessage);
}

export const bottleFormSchema = z.object({
  name: requiredText(NAME_REQUIRED_MESSAGE, NAME_TOO_LONG_MESSAGE),
  producer: requiredText(PRODUCER_REQUIRED_MESSAGE, PRODUCER_TOO_LONG_MESSAGE),
  vintage: z
    .string()
    .trim()
    // One issue per failure, so an empty field cannot also collect the range message.
    .superRefine((value, ctx) => {
      if (value === "") {
        ctx.addIssue({ code: "custom", message: VINTAGE_REQUIRED_MESSAGE, input: value });
        return;
      }

      if (!isVintageYear(value)) {
        ctx.addIssue({ code: "custom", message: vintageRangeMessage(), input: value });
      }
    }),
  region: requiredText(REGION_REQUIRED_MESSAGE, REGION_TOO_LONG_MESSAGE),
  photoUrl: z.string().trim().max(MAX_URL_LENGTH, PHOTO_URL_MESSAGE).refine(isHttpUrlOrEmpty, {
    error: PHOTO_URL_MESSAGE,
  }),
});

/** The form's values: strings only, as the schema validates them. */
export type BottleFormValues = z.infer<typeof bottleFormSchema>;

/** Every field has a default, so no control flips from uncontrolled to controlled. */
export const BOTTLE_FORM_DEFAULT_VALUES: BottleFormValues = {
  name: "",
  producer: "",
  vintage: "",
  region: "",
  photoUrl: "",
};

/**
 * The only conversion from the form's strings to the mutation's input.
 *
 * The return type is the generated `AddBottleInput`, so a schema that drifts from the API contract
 * fails `pnpm typecheck` here instead of reaching the server. The values are the schema's output,
 * i.e. already trimmed.
 */
export function toAddBottleInput(values: BottleFormValues): AddBottleInput {
  return {
    name: values.name,
    producer: values.producer,
    vintage: Number(values.vintage),
    region: values.region,
    photoUrl: values.photoUrl === "" ? undefined : values.photoUrl,
  };
}
