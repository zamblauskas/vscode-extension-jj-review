import { Effect, Option, Schema } from "effect";
import { SchemaError } from "effect/Schema";
import * as vscode from "vscode";
import { ChangeId, ChangeIdSchema } from "../model/revision";
import { UnknownError } from "effect/Cause";

export class ReviewRangeState {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  constructor(private readonly workspaceState: vscode.Memento) {}

  setFrom(
    from: Option.Option<ChangeId>,
  ): Effect.Effect<void, SchemaError | UnknownError> {
    return Effect.gen({ self: this }, function* () {
      const data = yield* Schema.encodeEffect(StateSchema)({ from });
      yield* Effect.tryPromise(() => this.workspaceState.update(key, data));
      this.emitter.fire();
    });
  }

  get(): Effect.Effect<State, SchemaError> {
    const stored = this.workspaceState.get<unknown>(key) ?? {};
    return Schema.decodeUnknownEffect(StateSchema)(stored);
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

export type State = typeof StateSchema.Type;

const key = "jjReview.reviewRange";

const StateSchema = Schema.Struct({
  from: Schema.OptionFromOptionalKey(ChangeIdSchema),
});
