import { Hunk, HunkHashSchema } from "../model/hunk";

export type JjHunkDto = {
  readonly startLineNumber: number;
  readonly hash: string;
};

export function toHunk(dto: JjHunkDto): Hunk {
  return {
    startLineNumber: dto.startLineNumber,
    hash: HunkHashSchema.make(dto.hash),
  };
}
