# Rules

1. Branch on variants with an exhaustive Effect `Match` only. End every match
   with `Match.exhaustive`. Do not use `switch` or `if` / `else` chains for
   this.

```typescript
return Match.type<FileStatus>().pipe(
  Match.when("modified", () => "modified"),
  Match.when("added", () => "added"),
  Match.when("removed", () => "removed"),
  Match.when("copied", () => "copied"),
  Match.when("renamed", () => "renamed"),
  Match.exhaustive,
)(status);
```

2. Put exported members at the top of the file, and private helpers below them.
