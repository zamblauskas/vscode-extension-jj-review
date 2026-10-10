import { Cause, Console, Effect, Option, pipe, Schema } from "effect";
import { ChangeId, ChangeIdSchema, Revision } from "../model/revision";
import { FsPath, FsPathPrefix, FsPathSchema } from "../model/fs-path";
import * as vscode from "vscode";
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
        { path: args.path, changeId: args.leftChangeId },
        { path: args.path, changeId: Option.some(args.rightChangeId) },
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
