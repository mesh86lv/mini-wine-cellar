import { Field, InputType, Int } from "@nestjs/graphql";
import { Transform, type TransformFnParams } from "class-transformer";
import {
  IsOptional,
  IsUrl,
  Length,
  MaxLength,
  Validate,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";

/**
 * The input of `addBottle`, with the same rules and the same messages the client shows. Every
 * message below is written out explicitly because the library defaults differ, and the user must
 * not be able to tell which side rejected the input.
 */

const MAX_TEXT_LENGTH = 120;
const MAX_URL_LENGTH = 2048;
const MIN_VINTAGE_YEAR = 1900;
const URL_MESSAGE = "Enter a valid URL starting with http:// or https://";

/** Trim first, so `"  Barolo  "` passes the length rules without padding the stored name. */
function trim({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim() : value;
}

/** An empty `photoUrl` means "not provided", which is the only value `@IsOptional` skips. */
function trimPhotoUrl({ value }: TransformFnParams): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/** A text field has two messages: one for "nothing entered", one for "too long". */
function textLengthOptions(emptyMessage: string, tooLongMessage: string): ValidationOptions {
  return {
    message: ({ value }: ValidationArguments): string =>
      typeof value === "string" && value.length > 0 ? tooLongMessage : emptyMessage,
  };
}

/** The upper bound is computed at validation time, so it is built when the message is needed. */
function vintageMessage(): string {
  return `Vintage must be a year between ${MIN_VINTAGE_YEAR} and ${new Date().getFullYear()}`;
}

/**
 * The vintage rule — a whole number from 1900 to the current year — as one constraint rather
 * than `@IsInt @Min @Max`: those take their bounds when the module loads, and a server that
 * lives through New Year's Eve must accept the new year and name it in the message.
 */
@ValidatorConstraint({ name: "isVintageYear" })
class IsVintageYearConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= MIN_VINTAGE_YEAR &&
      value <= new Date().getFullYear()
    );
  }

  defaultMessage(): string {
    return vintageMessage();
  }
}

@InputType()
export class AddBottleInput {
  @Field(() => String)
  @Transform(trim)
  @Length(
    1,
    MAX_TEXT_LENGTH,
    textLengthOptions("Enter the bottle name", "Name must be at most 120 characters"),
  )
  name!: string;

  @Field(() => String)
  @Transform(trim)
  @Length(
    1,
    MAX_TEXT_LENGTH,
    textLengthOptions("Enter the producer", "Producer must be at most 120 characters"),
  )
  producer!: string;

  @Field(() => Int)
  @Validate(IsVintageYearConstraint)
  vintage!: number;

  @Field(() => String)
  @Transform(trim)
  @Length(
    1,
    MAX_TEXT_LENGTH,
    textLengthOptions("Enter the region", "Region must be at most 120 characters"),
  )
  region!: string;

  @Field(() => String, { nullable: true })
  @Transform(trimPhotoUrl)
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { message: URL_MESSAGE })
  @MaxLength(MAX_URL_LENGTH, { message: URL_MESSAGE })
  photoUrl?: string | null;
}
