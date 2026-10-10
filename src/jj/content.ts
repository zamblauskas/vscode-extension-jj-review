import { Effect, Match, Option, PlatformError, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { FsPath } from "../model/fs-path";
import { ChangeId } from "../model/revision";
import { CommandError, runCommand } from "../util/cmd";

export const FileContentSchema = Schema.String.pipe(
  Schema.brand("FileContent"),
);
export type FileContent = typeof FileContentSchema.Type;

export function getFileContent(
  cwd: FsPath,
  changeId: Option.Option<ChangeId>,
  path: FsPath,
): Effect.Effect<
  Option.Option<FileContent>,
  PlatformError.PlatformError | CommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  if (Option.isNone(changeId)) {
    return Effect.succeed(Option.none());
  }
  const command = ChildProcess.make(
    "jj",
    [
      "file",
      "show",
      "--ignore-working-copy",
      "--no-pager",
      "--color=never",
      "--quiet",
      "--config=templates.file_show=",
      "-r",
      changeId.value,
      path,
    ],
    { cwd },
  );

  return runCommand(command).pipe(
    Effect.map(FileContentSchema.make),
    Effect.asSome,
    Effect.catchTag("CommandError", (e) => {
      if (e.exitCode === 1 && e.stderr === `Error: No such path: ${path}\n`) {
        return Effect.succeed(Option.none<FileContent>());
      } else {
        return Effect.fail(e);
      }
    }),
  );
}
