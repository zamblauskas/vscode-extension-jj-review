# JJ Review

Review [Jujutsu (`jj`)](https://github.com/jj-vcs/jj) revisions hunk by hunk,
right inside VS Code.

Keep track of what you've already inspected across stacked changes, rebases, and
working-copy edits without losing your place.

## Features

- **Revision & File Review Tree**: Browse revisions and their changed files in a
  dedicated sidebar view, complete with live review status icons (`unmarked`,
  `partial`, `marked`) for both files and whole revisions.
- **Hunk-by-Hunk Review**: Open side-by-side diffs for any file in a revision
  and mark individual hunks as reviewed using inline CodeLens actions.
- **Content-Addressed Hunk Tracking**: Hunks are tracked by content hash, so
  your review progress survives rebases and line number shifts as long as the
  hunk content stays the same.
- **Remaining Line & Hunk Counters**: See at a glance how many hunks and lines
  are left to review per file (`+2 -19 (1/4 · 15 left)`), per revision
  (`(18 left)`), and in hover tooltips.
- **Whole-File Mark / Unmark**: Quickly mark or unmark all hunks in a file
  directly from the tree view inline action buttons.
- **Configurable Review Range**: Pick the root revision (`Select Review Root`)
  to focus your review on a specific stack of changes.
- **Live `.jj` Watcher**: Automatically refreshes the revision tree as you run
  `jj` commands or edit your working copy.

## Install

```sh
pnpm install
pnpm package
code --install-extension jj-review-<version>.vsix
```
