import { Schema } from "effect";

export const FsPathSchema = Schema.String.pipe(Schema.brand("FsPath"));
export type FsPath = typeof FsPathSchema.Type;

export const FsPathPrefix = Schema.String.pipe(Schema.brand("FsPathPrefix"));
export type FsPathPrefix = typeof FsPathPrefix.Type;
