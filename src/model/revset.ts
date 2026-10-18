import { Match, Option, Schema } from "effect";
import { ChangeId } from "./revision";

export const RevsetSchema = Schema.String.pipe(Schema.brand("Revset"));

export type Revset = typeof RevsetSchema.Type;

export function makeRevset(
  from: Option.Option<ChangeId>,
  to: Option.Option<ChangeId>,
): Revset {
  return Match.value(from).pipe(
    Match.tag("None", () => RevsetSchema.make(defaultRevset)),
    Match.tag("Some", ({ value }) =>
      RevsetSchema.make(
        Option.match(to, {
          onNone: () =>
            `coalesce(present(${value}):: & (::@ | @::), ${defaultRevset})`,
          onSome: (toValue) =>
            `coalesce(present(${value})::present(${toValue}), ${defaultRevset})`,
        }),
      ),
    ),
    Match.exhaustive,
  );
}

const defaultRevset = "immutable_heads()..@";
