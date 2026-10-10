import { Effect, Option, Schema } from "effect";
import { SchemaError } from "effect/Schema";
import * as vscode from "vscode";
import { ChangeIdPathFromUriSchema, JjReviewUri } from "./uri";
import { slice } from "effect/String";

export type VsCodeOpenDiffArgs = {
  left: vscode.Uri;
  right: vscode.Uri;
  title: string;
  showOpts: vscode.TextDocumentShowOptions;
};

export function makeVsCodeOpenDiffArgs(
  leftChangeIdPath: JjReviewUri,
  rightChangeIdPath: JjReviewUri,
): Effect.Effect<VsCodeOpenDiffArgs, SchemaError> {
  return Effect.gen(function* () {
    const left = yield* Schema.encodeEffect(ChangeIdPathFromUriSchema)(
      leftChangeIdPath,
    );
    const right = yield* Schema.encodeEffect(ChangeIdPathFromUriSchema)(
      rightChangeIdPath,
    );
    const title = formatDiffTitle(leftChangeIdPath, rightChangeIdPath);
    const showOpts = {};

    return {
      left,
      right,
      title,
      showOpts,
    };
  });
}

function formatDiffTitle(
  leftChangeIdPath: JjReviewUri,
  rightChangeIdPath: JjReviewUri,
): string {
  const leftSide = Option.match(leftChangeIdPath.query.changeId, {
    onNone: () => "",
    onSome: (a) => slice(0, 3)(a) + ":",
  });

  const rightSide = Option.getOrElse(
    Option.map(rightChangeIdPath.query.changeId, slice(0, 3)),
    () => "",
  );

  return `${leftSide}${rightSide} ${rightChangeIdPath.path}`;
}
