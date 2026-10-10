import { Effect, pipe, PlatformError, Schema, Stream, Option } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { FsPath } from "../model/fs-path";
import {
  JjRootCandidateDto,
  JjRootCandidateDtoSchemaJson,
  JjRevisionDto,
  JjRevisionDtoSchemaJson,
} from "./log-dto";
import { Revset } from "../model/revset";

export function listRootCandidates(
  cwd: FsPath,
): Effect.Effect<
  ReadonlyArray<JjRootCandidateDto>,
  PlatformError.PlatformError | Schema.SchemaError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const command = ChildProcess.make(
    "jj",
    [
      "log",
      "--ignore-working-copy",
      "--no-graph",
      "-r",
      "immutable_heads()..@",
      "-T",
      rootCandidateTemplate,
    ],
    { cwd },
  );

  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    return yield* pipe(
      spawner.streamLines(command),
      Stream.mapEffect(
        (line) =>
          Schema.decodeUnknownEffect(JjRootCandidateDtoSchemaJson)(line),
        { concurrency: "unbounded" },
      ),
      Stream.runCollect,
    );
  });
}

export function listRevisions(
  cwd: FsPath,
  revset: Revset,
): Effect.Effect<
  ReadonlyArray<JjRevisionDto>,
  PlatformError.PlatformError | Schema.SchemaError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const command = ChildProcess.make(
    "jj",
    [
      "log",
      "--ignore-working-copy",
      "--no-graph",
      "-r",
      revset,
      "-T",
      logTemplate,
    ],
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
): Effect.Effect<JjRevisionDto, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(JjRevisionDtoSchemaJson)(line);
}

const rootCandidateTemplate = String.raw`
"{\"change_id\":"
++ json(change_id)
++ ",\"description\":"
++ json(description.first_line())
++ "}\n"
`;

const logTemplate = String.raw`
json(self).remove_suffix("}")
++ ",\"parentChangeIds\":"
++ json(parents.map(|p| p.change_id()))
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
