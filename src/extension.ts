import { NodeServices } from "@effect/platform-node";
import {
  Effect,
  Fiber,
  ManagedRuntime,
  Option,
  PlatformError,
  Stream,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import path from "node:path";
import * as vscode from "vscode";
import { getRevisionHunks } from "./jj/diff";
import { toHunk } from "./jj/diff-dto";
import { listRevisions } from "./jj/log";
import { JjRevisionDto } from "./jj/log-dto";
import { FsPathPrefix, FsPathSchema } from "./model/fs-path";
import { Revision } from "./model/revision";
import { MarkedHunksState } from "./state/marked-hunks";
import {
  makeMarkHunkCommand,
  makeSelectRootCommand,
  OpenDiffCommand,
  registerCommand,
} from "./ui/commands";
import { JjReviewContentProvider } from "./ui/content-provider";
import { HunkCodeLensProvider } from "./ui/hunk-lens";
import { RevisionTree } from "./ui/revision-tree";
import { JjReviewScheme } from "./ui/uri";
import { CommandError } from "./util/cmd";
import { fileChanges } from "./util/watcher";
import { ReviewRangeState } from "./state/review-range";
import { makeRevset } from "./model/revset";

export function activate(context: vscode.ExtensionContext): void {
  const runtime = ManagedRuntime.make(NodeServices.layer);
  const markedHunks = new MarkedHunksState(context.workspaceState);
  const reviewRangeState = new ReviewRangeState(context.workspaceState);

  const revisionTree = new RevisionTree(markedHunks, () => {
    return runtime.runPromise(
      Effect.gen(function* () {
        const { from } = yield* reviewRangeState.get();
        const entries = yield* listRevisions(
          cwd,
          makeRevset(from, Option.none()),
        );
        return yield* Effect.forEach(entries, toRevision);
      }),
    );
  });

  const fiber = runtime.runFork(
    Stream.runForEach(fileChanges(cwd, [jjDirPrefix]), () =>
      Effect.sync(() => {
        console.debug("Refreshing extension");
        revisionTree.refresh();
      }),
    ),
  );

  registerCommand(context, OpenDiffCommand);
  registerCommand(context, makeMarkHunkCommand(markedHunks));
  registerCommand(context, makeSelectRootCommand(cwd, reviewRangeState));

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("jj-review.view", revisionTree),
    markedHunks.onDidChange(() => {
      revisionTree.refresh();
    }),
    reviewRangeState.onDidChange(() => {
      revisionTree.refresh();
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      JjReviewScheme,
      new JjReviewContentProvider(cwd, runtime),
    ),
    vscode.languages.registerCodeLensProvider(
      { scheme: JjReviewScheme },
      new HunkCodeLensProvider(cwd, runtime, markedHunks),
    ),
    {
      dispose: () => {
        void runtime.runPromise(Fiber.interrupt(fiber));
        void runtime.dispose();
      },
    },
  );
}

export function deactivate(): void {}

function toRevision(
  revisionDto: JjRevisionDto,
): Effect.Effect<
  Revision,
  CommandError | PlatformError.PlatformError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return getRevisionHunks(cwd, revisionDto.changeId).pipe(
    Effect.map(
      (hunksByPath): Revision => ({
        _tag: "Revision",
        changeId: revisionDto.changeId,
        description: revisionDto.description,
        parentChangeIds: revisionDto.parentChangeIds,
        isCurrentCopy: revisionDto.isCurrentCopy,
        isConflict: revisionDto.isConflict,
        files: revisionDto.files.map((file) => ({
          _tag: "FileDiff",
          path: file.path,
          added: file.added,
          removed: file.removed,
          status: file.status,
          hunks: (hunksByPath.get(file.path) ?? []).map(toHunk),
        })),
      }),
    ),
  );
}

const cwd = FsPathSchema.make(
  vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
);
const jjDirPrefix = FsPathPrefix.make(`.jj${path.sep}`);
