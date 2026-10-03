import { Duration, Effect, FileSystem, PlatformError, Stream } from "effect";
import { WatchEvent } from "effect/FileSystem";
import { FsPath, FsPathPrefix } from "../model/fs-path";

export const fileChanges = (
  file: FsPath,
  exclude: ReadonlyArray<FsPathPrefix>,
): Stream.Stream<
  WatchEvent,
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return fs.watch(file, { recursive: true }).pipe(
        Stream.filter(
          (event) => !exclude.some((prefix) => event.path.startsWith(prefix)),
        ),
        Stream.debounce(Duration.millis(500)),
      );
    }),
  );
