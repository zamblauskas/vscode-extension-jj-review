import { Data, Effect, PlatformError, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly message: string;
}> {}

export function runCommand(
  command: ChildProcess.Command,
): Effect.Effect<
  string,
  PlatformError.PlatformError | CommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
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
        return stdout;
      } else {
        const code = exitCode.valueOf();
        return yield* Effect.fail(
          new CommandError({
            exitCode: code,
            stderr,
            message: `exit ${code}: ${stderr}`,
          }),
        );
      }
    }),
  );
}
