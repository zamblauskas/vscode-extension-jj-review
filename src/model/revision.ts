import { Schema, pipe } from "effect";
import { FsPathSchema } from "./fs-path";

export const FileDiffSchema = Schema.Struct({
  _tag: Schema.tagDefaultOmit("FileDiff"),
  path: FsPathSchema,
  added: Schema.Number,
  removed: Schema.Number,
  status: Schema.Literals([
    "modified",
    "added",
    "removed",
    "copied",
    "renamed",
  ]),
});
export type FileDiff = typeof FileDiffSchema.Type;
export type FileStatus = FileDiff["status"];

export const ChangeIdSchema = Schema.String.pipe(Schema.brand("ChangeId"));
export type ChangeId = typeof ChangeIdSchema.Type;

export const RevisionSchema = pipe(
  Schema.Struct({
    _tag: Schema.tagDefaultOmit("Revision"),
    changeId: ChangeIdSchema,
    description: Schema.String,
    isCurrentCopy: Schema.Boolean,
    isConflict: Schema.Boolean,
    files: Schema.Array(FileDiffSchema),
  }),
  Schema.encodeKeys({ changeId: "change_id" }),
);
export const RevisionSchemaJson = Schema.fromJsonString(RevisionSchema);
export type Revision = typeof RevisionSchema.Type;
