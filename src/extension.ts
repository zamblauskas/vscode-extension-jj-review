import { NodeServices } from "@effect/platform-node";
import { Effect, Fiber, ManagedRuntime, pipe, PubSub, Stream } from "effect";
import path from "node:path";
import * as vscode from "vscode";
import { listRevisions } from "./jj/log";
import { FsPathSchema, FsPathPrefix } from "./model/fs-path";
import { RevisionTree } from "./ui/revision-tree";
import { fileChanges } from "./util/watcher";
import { OpenDiffCommand, registerCommand } from "./ui/commands";
import { JjReviewContentProvider, JjReviewScheme } from "./ui/diff";

export function activate(context: vscode.ExtensionContext): void {
  const runtime = ManagedRuntime.make(NodeServices.layer);

  const revisionTree = new RevisionTree(() => {
    const program = listRevisions(cwd)
      .pipe(Effect.map((revisions) => Array.from(revisions)))
      .pipe(Effect.provide(NodeServices.layer));

    return Effect.runPromise(program);
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

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("jj-review.view", revisionTree),
    vscode.workspace.registerTextDocumentContentProvider(
      JjReviewScheme,
      new JjReviewContentProvider(cwd, runtime),
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

const cwd = FsPathSchema.make(
  vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
);
const jjDirPrefix = FsPathPrefix.make(`.jj${path.sep}`);
