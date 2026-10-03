import { Effect, pipe, PlatformError, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { FsPath } from "../model/fs-path";
import { Revision, RevisionSchemaJson } from "../model/revision";

export function listRevisions(
  cwd: FsPath,
): Effect.Effect<
  ReadonlyArray<Revision>,
  PlatformError.PlatformError | Schema.SchemaError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const command = ChildProcess.make(
    "jj",
    ["log", "--ignore-working-copy", "--no-graph", "-T", logTemplate],
    {
      cwd,
    },
  );

  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    return yield* pipe(
      spawner.streamLines(command),
      Stream.mapEffect(parseJjLogLine, { concurrency: "unbounded" }),
      Stream.runCollect,
    );
  });
}

export function parseJjLogLine(
  line: string,
): Effect.Effect<Revision, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(RevisionSchemaJson)(line);
}

const logTemplate = String.raw`
json(self).remove_suffix("}")
++ ",\"isCurrentCopy\":"
++ json(current_working_copy)
++ ",\"isConflict\":"
++ json(conflict)
++ ",\"files\":["
++ self.diff().stat().files().map(|file|
    "{\"path\":"
    ++ json(file.path())
    ++ ",\"added\":"
    ++ json(file.lines_added())
    ++ ",\"removed\":"
    ++ json(file.lines_removed())
    ++ ",\"status\":"
    ++ json(file.status())
    ++ "}"
  ).join(",")
++ "]}\n"
`;
