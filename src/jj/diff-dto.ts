import { Hunk, HunkHashSchema } from "../model/hunk";

export type JjHunkDto = {
  readonly startLineNumber: number;
  readonly added: number;
  readonly removed: number;
  readonly hash: string;
};

export function toHunk(dto: JjHunkDto): Hunk {
  return {
    startLineNumber: dto.startLineNumber,
    added: dto.added,
    removed: dto.removed,
    hash: HunkHashSchema.make(dto.hash),
  };
}
