import { Effect, Option, PlatformError, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { FsPath } from "../model/fs-path";
import { ChangeId } from "../model/revision";

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
  PlatformError.PlatformError,
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

  return Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr] = yield* Effect.all(
        [
          Stream.mkString(Stream.decodeText(handle.stdout)),
          Stream.mkString(Stream.decodeText(handle.stderr)),
        ],
        { concurrency: 2 },
      );
      const exitCode = yield* handle.exitCode;

      if (exitCode === ChildProcessSpawner.ExitCode(0)) {
        return Option.some(FileContentSchema.make(stdout));
      }

      if (stderr.trim() === noSuchPathMessage(path)) {
        return Option.none();
      }

      return yield* Effect.fail(
        PlatformError.systemError({
          _tag: "Unknown",
          module: "ChildProcess",
          method: "jj file show",
          description: stderr.trim() || `exit ${exitCode}`,
          pathOrDescriptor: path,
        }),
      );
    }),
  );
}

const noSuchPathMessage = (path: FsPath) => `Error: No such path: ${path}`;
