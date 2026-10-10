import { NodeServices } from "@effect/platform-node";
import { Cause, Console, Effect, Match, Option, pipe, Schema } from "effect";
import * as vscode from "vscode";
import { listRootCandidates } from "../jj/log";
import { FsPath, FsPathSchema } from "../model/fs-path";
import { HunkHashSchema } from "../model/hunk";
import { ChangeIdSchema, changeIdToShortStr } from "../model/revision";
import { MarkedHunksState } from "../state/marked-hunks";
import { ReviewRangeState } from "../state/review-range";
import { makeVsCodeOpenDiffArgs } from "./diff";

export interface JjReviewCommand<Args> {
  name: string;
  schema: Schema.Decoder<Args>;
  callback(args: Args): Effect.Effect<void, JjReviewCommandFailure>;
}

export type JjReviewCommandFailure = {
  message: string;
};

export function registerCommand<Args>(
  context: vscode.ExtensionContext,
  cmd: JjReviewCommand<Args>,
) {
  const decode = Schema.decodeUnknownEffect(cmd.schema);
  context.subscriptions.push(
    vscode.commands.registerCommand(cmd.name, async (args: unknown) => {
      Effect.runPromise(
        pipe(
          decode(args),
          Effect.tap((args) => Console.log(`Calling ${cmd.name} with ${args}`)),
          Effect.flatMap(cmd.callback),
          Effect.flatMap(() => Console.log(`${cmd.name} finished`)),
          Effect.catchCause((cause) =>
            Effect.sync(() => {
              vscode.window.showErrorMessage(Cause.pretty(cause));
            }),
          ),
        ),
      );
    }),
  );
}

export const OpenDiffCommandArgsSchema = Schema.Struct({
  path: FsPathSchema,
  leftChangeId: Schema.Option(ChangeIdSchema),
  rightChangeId: ChangeIdSchema,
});

export type OpenDiffCommandArgs = typeof OpenDiffCommandArgsSchema.Type;

export const OpenDiffCommand = {
  name: "jjReview.openDiff",
  schema: OpenDiffCommandArgsSchema,
  callback: (args) => {
    return Effect.gen(function* () {
      const vsCodeDiffArgs = yield* makeVsCodeOpenDiffArgs(
        {
          path: args.path,
          query: { side: "left", changeId: args.leftChangeId },
        },
        {
          path: args.path,
          query: { side: "right", changeId: Option.some(args.rightChangeId) },
        },
      );
      return yield* Effect.try(() =>
        vscode.commands.executeCommand<void>(
          "vscode.diff",
          vsCodeDiffArgs.left,
          vsCodeDiffArgs.right,
          vsCodeDiffArgs.title,
          vsCodeDiffArgs.showOpts,
        ),
      );
    });
  },
} satisfies JjReviewCommand<OpenDiffCommandArgs>;

export const MarkHunkCommandArgsSchema = Schema.Struct({
  hash: HunkHashSchema,
});

export type MarkHunkCommandArgs = typeof MarkHunkCommandArgsSchema.Type;

export function makeMarkHunkCommand(
  store: MarkedHunksState,
): JjReviewCommand<MarkHunkCommandArgs> {
  return {
    name: "jjReview.markHunk",
    schema: MarkHunkCommandArgsSchema,
    callback: (args) => store.mark(args.hash),
  };
}

export function makeSelectRootCommand(
  cwd: FsPath,
  reviewRange: ReviewRangeState,
): JjReviewCommand<void> {
  return {
    name: "jjReview.selectRoot",
    schema: Schema.Void,
    callback: () =>
      Effect.gen(function* () {
        const candidates = yield* listRootCandidates(cwd);
        const picked = yield* Effect.tryPromise(() =>
          vscode.window.showQuickPick(
            candidates.map((candidate) => ({
              label: changeIdToShortStr(candidate.changeId),
              description: candidate.description,
              changeId: candidate.changeId,
            })),
            { placeHolder: "Select review root revision" },
          ),
        );

        yield* Match.value(Option.fromUndefinedOr(picked)).pipe(
          Match.tag("None", () => Effect.void),
          Match.tag("Some", ({ value }) =>
            reviewRange.setFrom(Option.some(value.changeId)),
          ),
          Match.exhaustive,
        );
      }).pipe(Effect.provide(NodeServices.layer)),
  };
}
