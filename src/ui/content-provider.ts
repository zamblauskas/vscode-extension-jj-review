import { NodeServices } from "@effect/platform-node";
import {
  Effect,
  ManagedRuntime,
  Option,
  Schema,
  SchemaTransformation,
} from "effect";
import * as vscode from "vscode";
import { getFileContent } from "../jj/content";
import { FsPath } from "../model/fs-path";
import { FsPathSchema } from "../model/fs-path";
import { ChangeIdSchema } from "../model/revision";
import { ChangeIdPathFromUriSchema } from "./uri";

export class JjReviewContentProvider
  implements vscode.TextDocumentContentProvider
{
  constructor(
    private readonly cwd: FsPath,
    private readonly runtime: ManagedRuntime.ManagedRuntime<
      NodeServices.NodeServices,
      never
    >,
  ) {}

  provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
    const cwd = this.cwd;
    return this.runtime.runPromise(
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeEffect(ChangeIdPathFromUriSchema)(
          uri,
        );

        const contentOpt = yield* getFileContent(
          cwd,
          decoded.query.changeId,
          decoded.path,
        );

        return contentOpt.pipe(Option.getOrElse(() => ""));
      }),
    );
  }
}
