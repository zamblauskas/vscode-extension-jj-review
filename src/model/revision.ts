import { Schema } from "effect";
import { FsPath } from "./fs-path";
import { Hunk } from "./hunk";

export const FileStatusSchema = Schema.Literals([
  "modified",
  "added",
  "removed",
  "copied",
  "renamed",
]);
export type FileStatus = typeof FileStatusSchema.Type;

export type FileDiff = {
  readonly _tag: "FileDiff";
  readonly path: FsPath;
  readonly added: number;
  readonly removed: number;
  readonly status: FileStatus;
  readonly hunks: ReadonlyArray<Hunk>;
};

export const ChangeIdSchema = Schema.String.pipe(Schema.brand("ChangeId"));
export type ChangeId = typeof ChangeIdSchema.Type;

export function changeIdToShortStr(changeId: ChangeId): string {
  return changeId.substring(0, 3);
}

export type Revision = {
  readonly _tag: "Revision";
  readonly changeId: ChangeId;
  readonly description: string;
  readonly parentChangeIds: ReadonlyArray<ChangeId>;
  readonly isCurrentCopy: boolean;
  readonly isConflict: boolean;
  readonly files: ReadonlyArray<FileDiff>;
};
