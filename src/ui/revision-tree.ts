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
        Revision: (revision) => Effect.succeed(revisionTreeItem(revision)),
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

function revisionIcon(revision: Revision): vscode.ThemeIcon {
  const [icon, color] = Match.type<{
    readonly isCurrentCopy: boolean;
    readonly hasFiles: boolean;
  }>().pipe(
    Match.when(
      { isCurrentCopy: true, hasFiles: false },
      () => ["debug-breakpoint-unverified", "charts.green"] as const,
    ),
    Match.when(
      { isCurrentCopy: true, hasFiles: true },
      () => ["debug-breakpoint-disabled", "charts.green"] as const,
    ),
    Match.when(
      { isCurrentCopy: false, hasFiles: false },
      () => ["debug-breakpoint-unverified", "charts.blue"] as const,
    ),
    Match.when(
      { isCurrentCopy: false, hasFiles: true },
      () => ["debug-breakpoint-disabled", "charts.blue"] as const,
    ),
    Match.exhaustive,
  )({
    isCurrentCopy: revision.isCurrentCopy,
    hasFiles: revision.files.length > 0,
  });

  return new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}

function revisionTreeItem(revision: Revision): vscode.TreeItem {
  return {
    id: revision.changeId,
    label: changeIdToShortStr(revision.changeId),
    iconPath: revisionIcon(revision),
    description: revision.description,
    collapsibleState:
      revision.files.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
  };
}

function fileDiffIcon(file: FileDiffTreeNode): vscode.ThemeIcon {
  const [icon, color] = fileStatusAppearance(file.status);
  return new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}

function fileStatusAppearance(
  status: FileStatus,
): readonly [icon: string, color: string] {
  return Match.type<FileStatus>().pipe(
    Match.whenOr(
      "added",
      "copied",
      () => ["diff-added", "gitDecoration.addedResourceForeground"] as const,
    ),
    Match.when(
      "modified",
      () =>
        ["diff-modified", "gitDecoration.modifiedResourceForeground"] as const,
    ),
    Match.when(
      "removed",
      () =>
        ["diff-removed", "gitDecoration.deletedResourceForeground"] as const,
    ),
    Match.when(
      "renamed",
      () =>
        ["diff-renamed", "gitDecoration.renamedResourceForeground"] as const,
    ),
    Match.exhaustive,
  )(status);
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
  return {
    label: file.path,
    iconPath: fileDiffIcon(file),
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
    contextValue: fileMarkContextValue(markedHunks, totalHunks),
  };
}

function fileMarkContextValue(marked: number, total: number): FileMarkState {
  if (marked >= total) {
    return "marked";
  } else if (marked <= 0) {
    return "unmarked";
  } else {
    return "partial";
  }
}

type FileMarkState = "marked" | "unmarked" | "partial";

type FileDiffTreeNode = FileDiff & {
  readonly leftChangeId: Option.Option<ChangeId>;
  readonly rightChangeId: ChangeId;
};

type TreeNode = Revision | FileDiffTreeNode;
