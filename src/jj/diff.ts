import { createHash } from "node:crypto";
import { Effect, PlatformError } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { FsPath, FsPathSchema } from "../model/fs-path";
import { ChangeId } from "../model/revision";
import { CommandError, runCommand } from "../util/cmd";
import { JjHunkDto } from "./diff-dto";

// TODO: do we actually need this, given we can get the hunks from the revision?
export function getHunks(
  cwd: FsPath,
  changeId: ChangeId,
  path: FsPath,
): Effect.Effect<
  ReadonlyArray<JjHunkDto>,
  PlatformError.PlatformError | CommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const command = ChildProcess.make(
    "jj",
    [...diffArgs, "-r", changeId, "--", path],
    { cwd },
  );

  return runCommand(command).pipe(
    Effect.map((stdout) => parseHunks(path, stdout)),
    Effect.catchTag("CommandError", (e) => {
      if (e.exitCode === 1 && e.stderr === `Error: No such path: ${path}\n`) {
        return Effect.succeed([]);
      } else {
        return Effect.fail(e);
      }
    }),
  );
}

export function getRevisionHunks(
  cwd: FsPath,
  changeId: ChangeId,
): Effect.Effect<
  ReadonlyMap<FsPath, ReadonlyArray<JjHunkDto>>,
  PlatformError.PlatformError | CommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const command = ChildProcess.make("jj", [...diffArgs, "-r", changeId], {
    cwd,
  });

  return runCommand(command).pipe(Effect.map(parseRevisionHunks));
}

export function parseRevisionHunks(
  stdout: string,
): ReadonlyMap<FsPath, ReadonlyArray<JjHunkDto>> {
  const sections = new Map<FsPath, Array<string>>();
  let section: FileSection | undefined;

  for (const line of stdout.split("\n")) {
    if (line.startsWith(fileHeaderPrefix)) {
      section = { oldPath: undefined, lines: undefined };
      continue;
    }

    if (section === undefined) {
      continue;
    }

    if (section.lines !== undefined) {
      section.lines.push(line);
      continue;
    }

    if (line.startsWith(oldPathPrefix)) {
      section.oldPath = FsPathSchema.make(line.slice(oldPathPrefix.length));
      continue;
    }

    const path = readNewPath(line, section.oldPath);
    if (path !== undefined) {
      section.lines = [];
      sections.set(path, section.lines);
    }
  }

  return new Map(
    Array.from(sections, ([path, lines]) => [
      path,
      parseHunks(path, lines.join("\n")),
    ]),
  );
}

export function parseHunks(
  path: FsPath,
  stdout: string,
): ReadonlyArray<JjHunkDto> {
  const hunks: Array<JjHunkDto> = [];
  const occurrences = new Map<string, number>();
  let pending: OpenHunk | undefined;

  for (const line of stdout.split("\n")) {
    const header = readHunkHeader(line);
    if (header !== undefined) {
      appendHunk(hunks, path, occurrences, pending);
      pending = { ...header, lines: [] };
      continue;
    }

    if (pending !== undefined && isChangeLine(line)) {
      pending.lines.push(line);
    }
  }

  appendHunk(hunks, path, occurrences, pending);
  return hunks;
}

type OpenHunk = {
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: Array<string>;
};

type HunkHeader = {
  readonly newStart: number;
  readonly newCount: number;
};

function appendHunk(
  hunks: Array<JjHunkDto>,
  path: FsPath,
  occurrences: Map<string, number>,
  pending: OpenHunk | undefined,
): void {
  if (pending === undefined) {
    return;
  }

  hunks.push({
    startLineNumber: startLineNumber(pending.newStart, pending.newCount),
    hash: hashHunk(
      path,
      pending.lines,
      nextOrdinal(path, pending.lines, occurrences),
    ),
  });
}

// TODO: we need to hash the change ID as well
function hashHunk(
  path: FsPath,
  lines: ReadonlyArray<string>,
  ordinal: string,
): string {
  return createHash("sha256")
    .update(`${path}\n${lines.join("\n")}\n${ordinal}`)
    .digest("hex");
}

function nextOrdinal(
  path: FsPath,
  lines: ReadonlyArray<string>,
  occurrences: Map<string, number>,
): string {
  const key = `${path}\n${lines.join("\n")}`;
  const next = (occurrences.get(key) ?? 0) + 1;
  occurrences.set(key, next);
  return String(next).padStart(2, "0");
}

function startLineNumber(newStart: number, newCount: number): number {
  if (newCount === 0) {
    return newStart;
  }

  return Math.max(newStart - 1, 0);
}

function readHunkHeader(line: string): HunkHeader | undefined {
  const match = hunkHeaderPattern.exec(line);
  if (match === null) {
    return undefined;
  }

  const newStartText = match[1];
  if (newStartText === undefined) {
    return undefined;
  }

  const newCountText = match[2];
  return {
    newStart: Number(newStartText),
    newCount: newCountText === undefined ? 1 : Number(newCountText),
  };
}

function isChangeLine(line: string): boolean {
  return line.startsWith("+") || line.startsWith("-");
}

type FileSection = {
  oldPath: FsPath | undefined;
  lines: Array<string> | undefined;
};

function readNewPath(
  line: string,
  oldPath: FsPath | undefined,
): FsPath | undefined {
  if (line === deletedPathLine) {
    return oldPath;
  }

  if (line.startsWith(newPathPrefix)) {
    return FsPathSchema.make(line.slice(newPathPrefix.length));
  }

  return undefined;
}

const diffArgs = [
  "diff",
  "--git",
  "--context=0",
  "--ignore-working-copy",
  "--no-pager",
  "--color=never",
];

const fileHeaderPrefix = "diff --git ";
const oldPathPrefix = "--- a/";
const newPathPrefix = "+++ b/";
const deletedPathLine = "+++ /dev/null";

const hunkHeaderPattern = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
