import { Schema } from "effect";

export const HunkHashSchema = Schema.String.pipe(Schema.brand("HunkHash"));
export type HunkHash = typeof HunkHashSchema.Type;

export const HunkSchema = Schema.Struct({
  startLineNumber: Schema.Number,
  added: Schema.Number,
  removed: Schema.Number,
  hash: HunkHashSchema,
});
export type Hunk = typeof HunkSchema.Type;
