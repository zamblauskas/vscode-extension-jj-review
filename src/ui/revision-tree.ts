import * as vscode from "vscode";

import { Effect, Match, Option } from "effect";
import { SchemaError } from "effect/Schema";
import { Hunk } from "../model/hunk";
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
    const stats = yield* reviewStats(allHunks, markedHunksState);
    const markState =
      stats.totalHunks === 0
        ? "unmarked"
        : markStateFromCounts(stats.markedHunks, stats.totalHunks);

    return {
      id: revision.changeId,
      label: changeIdToShortStr(revision.changeId),
      iconPath: revisionIcon(markState),
      description: revisionDescription(revision.description, stats.linesLeft),
      tooltip: reviewTooltip(stats),
      collapsibleState:
        revision.files.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    };
  });
}

function revisionDescription(description: string, linesLeft: number): string {
  if (description.length === 0) {
    return `(${linesLeft} left)`;
  }

  return `(${linesLeft} left) ${description}`;
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
    const stats = yield* reviewStats(file.hunks, markedHunksState);
    return fileDiffTreeItemFromStats(file, stats);
  });
}

function fileDiffTreeItemFromStats(
  file: FileDiffTreeNode,
  stats: ReviewStats,
): vscode.TreeItem {
  const markState = markStateFromCounts(stats.markedHunks, stats.totalHunks);
  return {
    label: file.path,
    iconPath: fileDiffIcon(file, markState),
    description: `+${file.added} -${file.removed} (${stats.markedHunks}/${stats.totalHunks} · ${stats.linesLeft} left)`,
    tooltip: reviewTooltip(stats),
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

function reviewStats(
  hunks: ReadonlyArray<Hunk>,
  markedHunksState: MarkedHunksState,
): Effect.Effect<ReviewStats, SchemaError> {
  return Effect.gen(function* () {
    const unmarked = yield* Effect.filter(hunks, (hunk) =>
      markedHunksState
        .isMarked(hunk.hash)
        .pipe(Effect.map((marked) => !marked)),
    );
    const linesLeft = unmarked.reduce(
      (sum, hunk) => sum + hunk.added + hunk.removed,
      0,
    );
    return {
      markedHunks: hunks.length - unmarked.length,
      totalHunks: hunks.length,
      linesLeft,
    };
  });
}

function reviewTooltip(stats: ReviewStats): string {
  return `${stats.markedHunks}/${stats.totalHunks} hunks reviewed · ${stats.linesLeft} lines remaining`;
}

type ReviewStats = {
  readonly markedHunks: number;
  readonly totalHunks: number;
  readonly linesLeft: number;
};

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
