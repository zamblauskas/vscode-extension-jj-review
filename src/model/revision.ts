import { Schema } from "effect";
import { FsPathSchema } from "./fs-path";
import { HunkSchema } from "./hunk";

export const FileStatusSchema = Schema.Literals([
  "modified",
  "added",
  "removed",
  "copied",
  "renamed",
]);
export type FileStatus = typeof FileStatusSchema.Type;

export const FileDiffSchema = Schema.TaggedStruct("FileDiff", {
  path: FsPathSchema,
  added: Schema.Number,
  removed: Schema.Number,
  status: FileStatusSchema,
  hunks: Schema.Array(HunkSchema),
});

export type FileDiff = typeof FileDiffSchema.Type;

export const ChangeIdSchema = Schema.String.pipe(Schema.brand("ChangeId"));
export type ChangeId = typeof ChangeIdSchema.Type;

export function changeIdToShortStr(changeId: ChangeId): string {
  return changeId.substring(0, 3);
}

export const RevisionSchema = Schema.TaggedStruct("Revision", {
  changeId: ChangeIdSchema,
  description: Schema.String,
  parentChangeIds: Schema.Array(ChangeIdSchema),
  isCurrentCopy: Schema.Boolean,
  isConflict: Schema.Boolean,
  files: Schema.Array(FileDiffSchema),
});

export type Revision = typeof RevisionSchema.Type;
