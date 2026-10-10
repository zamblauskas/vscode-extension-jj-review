import { NodeServices } from "@effect/platform-node";
import { Effect, ManagedRuntime, Match, Schema } from "effect";
import { SchemaError } from "effect/Schema";
import * as vscode from "vscode";
import { getHunks } from "../jj/diff";
import { toHunk } from "../jj/diff-dto";
import { FsPath } from "../model/fs-path";
import { Hunk } from "../model/hunk";
import { MarkedHunksState } from "../state/marked-hunks";
import { ChangeIdPathFromUriSchema } from "./uri";

export class HunkCodeLensProvider implements vscode.CodeLensProvider {
  readonly onDidChangeCodeLenses: vscode.Event<void>;

  constructor(
    private readonly cwd: FsPath,
    private readonly runtime: ManagedRuntime.ManagedRuntime<
      NodeServices.NodeServices,
      never
    >,
    private readonly markedHunks: MarkedHunksState,
  ) {
    this.onDidChangeCodeLenses = markedHunks.onDidChange;
  }

  provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const cwd = this.cwd;
    const markedHunks = this.markedHunks;
    return this.runtime.runPromise(
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeEffect(ChangeIdPathFromUriSchema)(
          document.uri,
        );

        if (decoded.query.side === "left") {
          return yield* Effect.succeed([]);
        }

        return yield* Match.value(decoded.query.changeId).pipe(
          Match.tag("None", () => Effect.succeed([])),
          Match.tag("Some", ({ value: changeId }) =>
            getHunks(cwd, changeId, decoded.path).pipe(
              Effect.flatMap((hunks) =>
                unmarkedLenses(hunks.map(toHunk), markedHunks),
              ),
            ),
          ),
          Match.exhaustive,
        );
      }),
    );
  }
}

function unmarkedLenses(
  hunks: ReadonlyArray<Hunk>,
  markedHunks: MarkedHunksState,
): Effect.Effect<Array<vscode.CodeLens>, SchemaError> {
  return Effect.filter(hunks, (hunk) =>
    markedHunks.isMarked(hunk.hash).pipe(Effect.map((marked) => !marked)),
  ).pipe(Effect.map((unmarked) => unmarked.map(markLens)));
}

function markLens(hunk: Hunk): vscode.CodeLens {
  return new vscode.CodeLens(
    new vscode.Range(hunk.startLineNumber, 0, hunk.startLineNumber, 0),
    {
      title: "$(checklist) Mark",
      command: markHunkCommand,
      arguments: [{ hash: hunk.hash }],
    },
  );
}

const markHunkCommand = "jjReview.markHunk";
