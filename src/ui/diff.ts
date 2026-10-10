import * as vscode from "vscode";
import {
  Effect,
  ManagedRuntime,
  Option,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from "effect";
import { ChangeId, ChangeIdSchema, Revision } from "../model/revision";
import { FsPath, FsPathSchema } from "../model/fs-path";
import { getFileContent } from "../jj/content";
import { NodeServices } from "@effect/platform-node";
import { SchemaError } from "effect/Schema";

export type VsCodeOpenDiffArgs = {
  left: vscode.Uri;
  right: vscode.Uri;
  title: string;
  showOpts: vscode.TextDocumentShowOptions;
};

export function makeVsCodeOpenDiffArgs(
  leftChangeIdPath: ChangeIdPath,
  rightChangeIdPath: ChangeIdPath,
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

const VsCodeUri = Schema.declare(
  (u): u is vscode.Uri => u instanceof vscode.Uri,
);

const ChangeIdPathSchema = Schema.Struct({
  changeId: Schema.Option(ChangeIdSchema),
  path: FsPathSchema,
});

type ChangeIdPath = typeof ChangeIdPathSchema.Type;

export const ChangeIdPathFromUriSchema = VsCodeUri.pipe(
  Schema.decodeTo(
    ChangeIdPathSchema,
    SchemaTransformation.transformEffect({
      decode: (uri, options) => {
        if (uri.scheme === undefined || uri.scheme !== JjReviewScheme) {
          return Effect.fail(
            new SchemaIssue.InvalidValue({
              message: `Invalid scheme "${uri.scheme}", expected "${JjReviewScheme}"`,
              uri,
              options,
            }),
          );
        }

        const changeId: Option.Option<string> =
          uri.query.trim().length > 0 ? Option.some(uri.query) : Option.none();

        return Effect.succeed({ changeId, path: uri.path });
      },
      encode: ({ changeId, path }) => {
        return Effect.succeed(
          vscode.Uri.from({
            scheme: JjReviewScheme,
            path: path,
            query: Option.getOrElse(changeId, () => ""),
          }),
        );
      },
    }),
  ),
);

export const JjReviewScheme = "jjReview";

export class JjReviewContentProvider
  implements vscode.TextDocumentContentProvider
{
  constructor(
    private readonly cwd: FsPath,
    private readonly runtime: ManagedRuntime.ManagedRuntime<
      NodeServices.NodeServices,
      never
    >,
  ) {}

  provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
    const cwd = this.cwd;
    return this.runtime.runPromise(
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeEffect(ChangeIdPathFromUriSchema)(
          uri,
        );
        const contentOpt = yield* getFileContent(
          cwd,
          decoded.changeId,
          decoded.path,
        );

        return contentOpt.pipe(Option.getOrElse(() => ""));
      }),
    );
  }
}

function formatDiffTitle(
  leftChangeIdPath: ChangeIdPath,
  rightChangeIdPath: ChangeIdPath,
): string {
  const changeIdPrefix = `${Option.map(leftChangeIdPath.changeId, (changeId) => changeId.slice(0, 3))}:`;

  return `${changeIdPrefix}${Option.map(rightChangeIdPath.changeId, (changeId) => changeId.slice(0, 3))} ${rightChangeIdPath.path}`;
}
