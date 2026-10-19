import * as vscode from "vscode";

import { Effect, Match, Option } from "effect";
import { SchemaError } from "effect/Schema";
import {
  ChangeId,
  FileDiff,
  FileStatus,
  Revision,
  changeIdToShortStr,
} from "../model/revision";
import { MarkedHunksState } from "../state/marked-hunks";
import { OpenDiffCommand, OpenDiffCommandArgs } from "./commands";

export class RevisionTree implements vscode.TreeDataProvider<TreeNode> {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(
    private readonly markedHunks: MarkedHunksState,
    private readonly listRevisions: () => Promise<ReadonlyArray<Revision>>,
  ) {}

  getTreeItem(element: TreeNode): Promise<vscode.TreeItem> {
    return Effect.runPromise(
      Match.typeTags<TreeNode>()({
        Revision: (revision) => revisionTreeItem(revision, this.markedHunks),
        FileDiff: (file) => fileDiffTreeItem(file, this.markedHunks),
      })(element),
    );
  }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    const revisions = await this.listRevisions();

    if (node == undefined) {
      return Array.from(revisions);
    }

    return Match.typeTags<TreeNode>()({
      Revision: (revision) =>
        Promise.resolve(
          Array.from(
            revision.files.map((f) => ({
              ...f,
              leftChangeId: firstParent(revision),
              rightChangeId: revision.changeId,
            })),
          ),
        ),
      FileDiff: () => Promise.resolve([]),
    })(node);
  }

  refresh() {
    this.emitter.fire(undefined);
  }
}

function firstParent(revision: Revision): Option.Option<ChangeId> {
  return Option.fromUndefinedOr(revision.parentChangeIds[0]);
}

function revisionIcon(markState: MarkState): vscode.ThemeIcon {
  const [icon, color] = Match.type<MarkState>().pipe(
    Match.when(
      "marked",
      () => ["diff-added", "gitDecoration.addedResourceForeground"] as const,
    ),
    Match.when(
      "partial",
      () =>
        ["diff-modified", "gitDecoration.modifiedResourceForeground"] as const,
    ),
    Match.when("unmarked", () => ["debug-stop", "disabledForeground"] as const),
    Match.exhaustive,
  )(markState);

  return new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}

function revisionTreeItem(
  revision: Revision,
  markedHunksState: MarkedHunksState,
): Effect.Effect<vscode.TreeItem, SchemaError> {
  return Effect.gen(function* () {
    const allHunks = revision.files.flatMap((file) => file.hunks);
    const totalHunks = allHunks.length;
    const markedHunks = (yield* Effect.filter(allHunks, (hunk) =>
      markedHunksState.isMarked(hunk.hash),
    )).length;
    const markState =
      totalHunks === 0
        ? "unmarked"
        : markStateFromCounts(markedHunks, totalHunks);

    return {
      id: revision.changeId,
      label: changeIdToShortStr(revision.changeId),
      iconPath: revisionIcon(markState),
      description: revision.description,
      collapsibleState:
        revision.files.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    };
  });
}

function fileDiffIcon(
  file: FileDiffTreeNode,
  markState: MarkState,
): vscode.ThemeIcon {
  const [icon, color] = fileStatusAppearance(file.status, markState);
  return new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}

function fileStatusAppearance(
  status: FileStatus,
  markState: MarkState,
): readonly [icon: string, color: string] {
  return Match.type<MarkState>().pipe(
    Match.whenOr(
      "marked",
      () => ["pass-filled", "gitDecoration.addedResourceForeground"] as const,
    ),
    Match.when(
      "partial",
      () => ["issues", "gitDecoration.modifiedResourceForeground"] as const,
    ),
    Match.when(
      "unmarked",
      () => ["circle-large-outline", "disabledForeground"] as const,
    ),
    Match.exhaustive,
  )(markState);
}

function fileDiffTreeItem(
  file: FileDiffTreeNode,
  markedHunksState: MarkedHunksState,
): Effect.Effect<vscode.TreeItem, SchemaError> {
  return Effect.gen(function* () {
    const totalHunks = file.hunks.length;
    const markedHunks = (yield* Effect.filter(file.hunks, (hunk) =>
      markedHunksState.isMarked(hunk.hash),
    )).length;
    return fileDiffTreeItemFromCounts(file, markedHunks, totalHunks);
  });
}

function fileDiffTreeItemFromCounts(
  file: FileDiffTreeNode,
  markedHunks: number,
  totalHunks: number,
): vscode.TreeItem {
  const markState = markStateFromCounts(markedHunks, totalHunks);
  return {
    label: file.path,
    iconPath: fileDiffIcon(file, markState),
    description: `+${file.added} -${file.removed} (${markedHunks}/${totalHunks})`,
    command: {
      command: OpenDiffCommand.name,
      title: "Open Diff",
      arguments: [
        {
          leftChangeId: file.leftChangeId,
          rightChangeId: file.rightChangeId,
          path: file.path,
        } satisfies OpenDiffCommandArgs,
      ],
    },
    contextValue: markState,
  };
}

function markStateFromCounts(marked: number, total: number): MarkState {
  if (marked >= total) {
    return "marked";
  } else if (marked <= 0) {
    return "unmarked";
  } else {
    return "partial";
  }
}

type MarkState = "marked" | "unmarked" | "partial";

type FileDiffTreeNode = FileDiff & {
  readonly leftChangeId: Option.Option<ChangeId>;
  readonly rightChangeId: ChangeId;
};

type TreeNode = Revision | FileDiffTreeNode;
