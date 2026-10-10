import { Schema } from "effect";
import { ChangeIdSchema, FileStatusSchema } from "../model/revision";
import { FsPathSchema } from "../model/fs-path";

export const JjRootCandidateDtoSchema = Schema.Struct({
  changeId: ChangeIdSchema,
  description: Schema.String,
}).pipe(Schema.encodeKeys({ changeId: "change_id" }));

export const JjRootCandidateDtoSchemaJson = Schema.fromJsonString(
  JjRootCandidateDtoSchema,
);

export type JjRootCandidateDto = typeof JjRootCandidateDtoSchema.Type;

export const JjRevisionDtoSchema = Schema.Struct({
  changeId: ChangeIdSchema,
  description: Schema.String,
  parentChangeIds: Schema.Array(ChangeIdSchema),
  isCurrentCopy: Schema.Boolean,
  isConflict: Schema.Boolean,
  files: Schema.Array(
    Schema.Struct({
      path: FsPathSchema,
      added: Schema.Number,
      removed: Schema.Number,
      status: FileStatusSchema,
    }),
  ),
}).pipe(Schema.encodeKeys({ changeId: "change_id" }));

export const JjRevisionDtoSchemaJson =
  Schema.fromJsonString(JjRevisionDtoSchema);

export type JjRevisionDto = typeof JjRevisionDtoSchema.Type;
