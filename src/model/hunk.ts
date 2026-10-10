import { Schema } from "effect";

export const HunkHashSchema = Schema.String.pipe(Schema.brand("HunkHash"));
export type HunkHash = typeof HunkHashSchema.Type;

export type Hunk = {
  readonly startLineNumber: number;
  readonly hash: HunkHash;
};
