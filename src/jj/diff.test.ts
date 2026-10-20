import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FsPathSchema } from "../model/fs-path";
import { parseHunks, parseRevisionHunks } from "./diff";
import { JjHunkDto } from "./diff-dto";

describe("parseHunks", () => {
  const path = FsPathSchema.make("src/foo.ts");

  function hashFor(
    lines: ReadonlyArray<string>,
    ordinal: string,
  ): JjHunkDto["hash"] {
    return createHash("sha256")
      .update(`${path}\n${lines.join("\n")}\n${ordinal}`)
      .digest("hex");
  }

  it("parses a single hunk", () => {
    const lines = ["-old line", "+new line", "+extra line"];
    const stdout = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 1111111..2222222 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -4 +4,2 @@ main",
      " unchanged",
      ...lines,
      "\\ No newline at end of file",
    ].join("\n");

    expect(parseHunks(path, stdout)).toEqual([
      {
        startLineNumber: 3,
        added: 2,
        removed: 1,
        hash: hashFor(lines, "01"),
      },
    ]);
  });

  it("keeps change lines that look like file headers", () => {
    const lines = ["--- removed comment", "+++ added counter"];
    const stdout = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -4 +4 @@",
      ...lines,
    ].join("\n");

    expect(parseHunks(path, stdout)).toEqual([
      {
        startLineNumber: 3,
        added: 1,
        removed: 1,
        hash: hashFor(lines, "01"),
      },
    ]);
  });

  it("parses multiple hunks", () => {
    const first = ["-alpha", "-beta", "+beta"];
    const second = ["-gamma", "+gamma", "+delta", "+epsilon", "+zeta"];
    const stdout = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,3 +1 @@",
      ...first,
      "@@ -20,1 +21,4 @@",
      ...second,
    ].join("\n");

    expect(parseHunks(path, stdout)).toEqual([
      {
        startLineNumber: 0,
        added: 1,
        removed: 2,
        hash: hashFor(first, "01"),
      },
      {
        startLineNumber: 20,
        added: 4,
        removed: 1,
        hash: hashFor(second, "01"),
      },
    ]);
  });

  it("places a deletion-only hunk at the new start line", () => {
    const lines = ["-removed one", "-removed two"];
    const stdout = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -8,2 +7,0 @@",
      ...lines,
    ].join("\n");

    expect(parseHunks(path, stdout)).toEqual([
      {
        startLineNumber: 7,
        added: 0,
        removed: 2,
        hash: hashFor(lines, "01"),
      },
    ]);
  });

  it("gives identical hunks different hashes", () => {
    const lines = ["-same", "+same"];
    const stdout = [
      "@@ -2,2 +2,2 @@",
      ...lines,
      "@@ -40,2 +50,2 @@",
      ...lines,
    ].join("\n");

    expect(parseHunks(path, stdout)).toEqual([
      {
        startLineNumber: 1,
        added: 1,
        removed: 1,
        hash: hashFor(lines, "01"),
      },
      {
        startLineNumber: 49,
        added: 1,
        removed: 1,
        hash: hashFor(lines, "02"),
      },
    ]);
  });

  it("keeps the same hash when only line numbers move", () => {
    const lines = ["-same", "+same"];
    const early = ["@@ -2,2 +2,2 @@", ...lines].join("\n");
    const late = ["@@ -80,5 +90,2 @@", ...lines].join("\n");

    expect(parseHunks(path, early)).toEqual([
      {
        startLineNumber: 1,
        added: 1,
        removed: 1,
        hash: hashFor(lines, "01"),
      },
    ]);
    expect(parseHunks(path, late)).toEqual([
      {
        startLineNumber: 89,
        added: 1,
        removed: 1,
        hash: hashFor(lines, "01"),
      },
    ]);
  });
});

describe("parseRevisionHunks", () => {
  function expectedHunks(path: string, lines: ReadonlyArray<string>) {
    return parseHunks(FsPathSchema.make(path), lines.join("\n"));
  }

  it("reads a path containing ' b/'", () => {
    const hunk = ["@@ -1,1 +1,1 @@", "-x", "+y"];
    const stdout = [
      "diff --git a/foo b/bar.ts b/foo b/bar.ts",
      "index 587be6b4c3..975fbec825 100644",
      "--- a/foo b/bar.ts",
      "+++ b/foo b/bar.ts",
      ...hunk,
    ].join("\n");

    expect(parseRevisionHunks(stdout)).toEqual(
      new Map([["foo b/bar.ts", expectedHunks("foo b/bar.ts", hunk)]]),
    );
  });

  it("reads a renamed file under its new path", () => {
    const hunk = ["@@ -1,0 +2,1 @@", "+z"];
    const stdout = [
      "diff --git a/gone.ts b/new.ts",
      "rename from gone.ts",
      "rename to new.ts",
      "index 587be6b4c3..206b37888d 100644",
      "--- a/gone.ts",
      "+++ b/new.ts",
      ...hunk,
    ].join("\n");

    expect(parseRevisionHunks(stdout)).toEqual(
      new Map([["new.ts", expectedHunks("new.ts", hunk)]]),
    );
  });

  it("reads a deleted file under its old path", () => {
    const hunk = ["@@ -1,1 +0,0 @@", "-x"];
    const stdout = [
      "diff --git a/old.ts b/old.ts",
      "deleted file mode 100644",
      "index 587be6b4c3..0000000000",
      "--- a/old.ts",
      "+++ /dev/null",
      ...hunk,
    ].join("\n");

    expect(parseRevisionHunks(stdout)).toEqual(
      new Map([["old.ts", expectedHunks("old.ts", hunk)]]),
    );
  });

  it("reads an added file", () => {
    const hunk = ["@@ -0,0 +1,1 @@", "+x"];
    const stdout = [
      "diff --git a/added.ts b/added.ts",
      "new file mode 100644",
      "index 0000000000..587be6b4c3",
      "--- /dev/null",
      "+++ b/added.ts",
      ...hunk,
    ].join("\n");

    expect(parseRevisionHunks(stdout)).toEqual(
      new Map([["added.ts", expectedHunks("added.ts", hunk)]]),
    );
  });

  it("splits multiple files", () => {
    const first = ["@@ -1,1 +1,1 @@", "-x", "+y"];
    const second = ["@@ -1,1 +1,1 @@", "-a", "+b"];
    const stdout = [
      "diff --git a/one.ts b/one.ts",
      "--- a/one.ts",
      "+++ b/one.ts",
      ...first,
      "diff --git a/two.ts b/two.ts",
      "--- a/two.ts",
      "+++ b/two.ts",
      ...second,
    ].join("\n");

    expect(parseRevisionHunks(stdout)).toEqual(
      new Map([
        ["one.ts", expectedHunks("one.ts", first)],
        ["two.ts", expectedHunks("two.ts", second)],
      ]),
    );
  });

  it("skips a file section without content changes", () => {
    const stdout = [
      "diff --git a/image.png b/image.png",
      "index 587be6b4c3..975fbec825 100644",
      "Binary files a/image.png and b/image.png differ",
    ].join("\n");

    expect(parseRevisionHunks(stdout)).toEqual(new Map());
  });
});
