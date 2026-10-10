import { Schema, SchemaTransformation } from "effect";
import * as vscode from "vscode";
import { FsPathSchema } from "../model/fs-path";
import { ChangeIdSchema } from "../model/revision";

export const JjReviewScheme = "jjReview";

export const JjReviewUriSchema = Schema.Struct({
  path: FsPathSchema,
  query: Schema.String.pipe(
    Schema.decodeTo(
      Schema.fromURLSearchParams(
        Schema.Struct({
          side: Schema.Literals(["left", "right"]),
          changeId: Schema.OptionFromOptionalKey(ChangeIdSchema),
        }),
      ),
      SchemaTransformation.transform({
        decode: (query) => new URLSearchParams(query),
        encode: (params) => params.toString(),
      }),
    ),
  ),
});

export type JjReviewUri = typeof JjReviewUriSchema.Type;

export const ChangeIdPathFromUriSchema = Schema.declare(
  (u): u is vscode.Uri => u instanceof vscode.Uri,
).pipe(
  Schema.check(
    Schema.makeFilter(
      (uri) =>
        uri.scheme === JjReviewScheme ||
        `Invalid scheme "${uri.scheme}", expected "${JjReviewScheme}"`,
    ),
  ),
  Schema.decodeTo(
    JjReviewUriSchema,
    SchemaTransformation.transform({
      decode: (uri) => ({ path: uri.path, query: uri.query }),
      encode: (parts) => vscode.Uri.from({ scheme: JjReviewScheme, ...parts }),
    }),
  ),
);
