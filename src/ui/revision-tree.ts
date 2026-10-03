import * as vscode from "vscode";

import {
  FileDiff,
  FileStatus,
  FileDiffSchema,
  Revision,
  RevisionSchema,
  ChangeIdSchema,
} from "../model/revision";
import { Effect, Match, Option, Schema } from "effect";
import { NodeServices } from "@effect/platform-node";
import { Brand } from "effect/Brand";
import { Readonly } from "effect/ai/Tool";
import { OpenDiffCommand, OpenDiffCommandArgs } from "./commands";

export class RevisionTree implements vscode.TreeDataProvider<TreeNode> {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(
    private readonly listRevisions: () => Promise<ReadonlyArray<Revision>>,
  ) {}

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return Match.typeTags<TreeNode>()({
      Revision: revisionTreeItem,
      FileDiff: fileDiffTreeItem,
    })(element);
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
              leftChangeId: previousRevision(revision, revisions).pipe(
                Option.map((r) => r.changeId),
              ),
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

function previousRevision(
  revision: Revision,
  revisions: ReadonlyArray<Revision>,
): Option.Option<Revision> {
  const idx = revisions.findIndex((r) => r.changeId === revision.changeId);
  return Option.fromUndefinedOr(revisions[idx + 1]);
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
    label: revision.changeId.substring(0, 3),
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

function fileDiffTreeItem(file: FileDiffTreeNode): vscode.TreeItem {
  return {
    label: file.path,
    iconPath: fileDiffIcon(file),
    description: `+${file.added} -${file.removed}`,
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
  };
}

const FileDiffTreeNodeSchema = FileDiffSchema.pipe(
  Schema.fieldsAssign({
    leftChangeId: Schema.Option(ChangeIdSchema),
    rightChangeId: ChangeIdSchema,
  }),
);
type FileDiffTreeNode = typeof FileDiffTreeNodeSchema.Type;

const TreeNodeSchema = Schema.Union([RevisionSchema, FileDiffTreeNodeSchema]);
type TreeNode = typeof TreeNodeSchema.Type;
