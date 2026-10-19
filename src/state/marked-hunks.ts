import { Effect, Schema } from "effect";
import { UnknownError } from "effect/Cause";
import { SchemaError } from "effect/Schema";
import * as vscode from "vscode";
import { HunkHash, HunkHashSchema } from "../model/hunk";
export class MarkedHunksState {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  constructor(private readonly workspaceState: vscode.Memento) {}

  isMarked(hash: HunkHash): Effect.Effect<boolean, SchemaError> {
    return this.get().pipe(Effect.map((hashes) => hashes.includes(hash)));
  }

  markAll(
    hashes: ReadonlyArray<HunkHash>,
  ): Effect.Effect<void, SchemaError | UnknownError> {
    return this.update((s) => [...new Set([...s, ...hashes])]);
  }

  unmarkAll(
    hashes: ReadonlyArray<HunkHash>,
  ): Effect.Effect<void, SchemaError | UnknownError> {
    return this.update((current) => current.filter((h) => !hashes.includes(h)));
  }

  mark(hash: HunkHash): Effect.Effect<void, SchemaError | UnknownError> {
    return this.markAll([hash]);
  }

  // TODO very inefficient - cache until something is marked?
  private get(): Effect.Effect<State, SchemaError> {
    const stored = this.workspaceState.get<unknown>(key) ?? [];
    return Schema.decodeUnknownEffect(StateSchema)(stored);
  }

  private update(
    f: (s: State) => State,
  ): Effect.Effect<void, SchemaError | UnknownError> {
    return Effect.gen({ self: this }, function* () {
      const s = yield* this.get();
      yield* Effect.tryPromise(() => this.workspaceState.update(key, f(s)));
      this.emitter.fire();
    });
  }
}

type State = typeof StateSchema.Type;

const key = "jjReview.markedHunks";

const StateSchema = Schema.Array(HunkHashSchema);
