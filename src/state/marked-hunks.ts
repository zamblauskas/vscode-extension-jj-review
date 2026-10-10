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

  mark(hash: HunkHash): Effect.Effect<void, SchemaError | UnknownError> {
    return Effect.gen({ self: this }, function* () {
      const hashes = yield* this.get();
      if (hashes.includes(hash)) {
        return;
      }

      const data = yield* Schema.encodeEffect(StateSchema)([...hashes, hash]);
      yield* Effect.tryPromise(() => this.workspaceState.update(key, data));
      this.emitter.fire();
    });
  }

  // TODO very inefficient - cache until something is marked?
  private get(): Effect.Effect<State, SchemaError> {
    const stored = this.workspaceState.get<unknown>(key) ?? [];
    return Schema.decodeUnknownEffect(StateSchema)(stored);
  }
}

type State = typeof StateSchema.Type;

const key = "jjReview.markedHunks";

const StateSchema = Schema.Array(HunkHashSchema);
