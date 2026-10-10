import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ChangeIdSchema } from "../model/revision";
import { parseJjLogLine } from "./log";

describe("parseJjLogLine", () => {
  it("reads the working copy", () => {
    const result = Effect.runSync(
      parseJjLogLine(
        '{"commit_id":"ef3e51029b2395a039764044ed7c43eb2d4c3a68","parents":["35fe9936c4e0966abc01648cd9d87577cb55f1a9"],"change_id":"qzsoyvxrknqvnrqkuywqqtvtnorklsmy","description":"","author":{"name":"Alex Example","email":"alex@example.com","timestamp":"2026-10-03T12:59:31+03:00"},"committer":{"name":"Alex Example","email":"alex@example.com","timestamp":"2026-10-04T09:08:18+03:00"},"parentChangeIds":["ykssyoxnvxxqwzpoxtorsmuypntpnlok"],"isCurrentCopy":true,"isConflict":false,"files":[{"path":"src/jj/log.test.ts","added":103,"removed":27,"status":"modified"},{"path":"src/jj/log.ts","added":41,"removed":35,"status":"modified"},{"path":"src/model/revision.ts","added":36,"removed":8,"status":"modified"}]}',
      ),
    );

    expect(result).toEqual({
      changeId: ChangeIdSchema.make("qzsoyvxrknqvnrqkuywqqtvtnorklsmy"),
      description: "",
      parentChangeIds: [
        ChangeIdSchema.make("ykssyoxnvxxqwzpoxtorsmuypntpnlok"),
      ],
      isCurrentCopy: true,
      isConflict: false,
      files: [
        {
          path: "src/jj/log.test.ts",
          added: 103,
          removed: 27,
          status: "modified",
        },
        {
          path: "src/jj/log.ts",
          added: 41,
          removed: 35,
          status: "modified",
        },
        {
          path: "src/model/revision.ts",
          added: 36,
          removed: 8,
          status: "modified",
        },
      ],
    });
  });

  it("reads added and removed files", () => {
    const result = Effect.runSync(
      parseJjLogLine(
        '{"commit_id":"35fe9936c4e0966abc01648cd9d87577cb55f1a9","parents":["f0e60fa93189198515941f1957075611fb9f8805"],"change_id":"ykssyoxnvxxqwzpoxtorsmuypntpnlok","description":"","author":{"name":"Alex Example","email":"alex@example.com","timestamp":"2026-10-03T10:06:31+03:00"},"committer":{"name":"Alex Example","email":"alex@example.com","timestamp":"2026-10-03T12:54:29+03:00"},"parentChangeIds":["yytmpmlpuwlwmtmqznpzntyopzusputn"],"isCurrentCopy":false,"isConflict":false,"files":[{"path":"package.json","added":4,"removed":1,"status":"modified"},{"path":"pnpm-lock.yaml","added":740,"removed":2,"status":"modified"},{"path":"src/extension.ts","added":13,"removed":3,"status":"modified"},{"path":"src/jj/log.test.ts","added":30,"removed":0,"status":"added"},{"path":"src/jj/log.ts","added":50,"removed":0,"status":"added"},{"path":"src/revisions-tree.ts","added":0,"removed":7,"status":"removed"}]}',
      ),
    );

    expect(result).toEqual({
      changeId: ChangeIdSchema.make("ykssyoxnvxxqwzpoxtorsmuypntpnlok"),
      description: "",
      parentChangeIds: [
        ChangeIdSchema.make("yytmpmlpuwlwmtmqznpzntyopzusputn"),
      ],
      isCurrentCopy: false,
      isConflict: false,
      files: [
        {
          path: "package.json",
          added: 4,
          removed: 1,
          status: "modified",
        },
        {
          path: "pnpm-lock.yaml",
          added: 740,
          removed: 2,
          status: "modified",
        },
        {
          path: "src/extension.ts",
          added: 13,
          removed: 3,
          status: "modified",
        },
        {
          path: "src/jj/log.test.ts",
          added: 30,
          removed: 0,
          status: "added",
        },
        {
          path: "src/jj/log.ts",
          added: 50,
          removed: 0,
          status: "added",
        },
        {
          path: "src/revisions-tree.ts",
          added: 0,
          removed: 7,
          status: "removed",
        },
      ],
    });
  });

  it("reads a description and added files", () => {
    const result = Effect.runSync(
      parseJjLogLine(
        '{"commit_id":"dbd9e2adefe618e5ed71098fef7459550254e919","parents":["0000000000000000000000000000000000000000"],"change_id":"yytmpmlpuwlwmtmqznpzntyopzusputn","description":"Bare minimum\\n","author":{"name":"Alex Example","email":"alex@example.com","timestamp":"2026-10-03T08:58:28+03:00"},"committer":{"name":"Alex Example","email":"alex@example.com","timestamp":"2026-10-03T09:40:33+03:00"},"parentChangeIds":["zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"],"isCurrentCopy":false,"isConflict":false,"files":[{"path":".gitignore","added":3,"removed":0,"status":"added"},{"path":".vscodeignore","added":12,"removed":0,"status":"added"},{"path":"AGENTS.md","added":0,"removed":0,"status":"added"},{"path":"LICENSE","added":7,"removed":0,"status":"added"},{"path":"README.md","added":10,"removed":0,"status":"added"},{"path":"media/icon.svg","added":3,"removed":0,"status":"added"},{"path":"package.json","added":49,"removed":0,"status":"added"},{"path":"pnpm-lock.yaml","added":2620,"removed":0,"status":"added"},{"path":"pnpm-workspace.yaml","added":4,"removed":0,"status":"added"},{"path":"src/extension.ts","added":25,"removed":0,"status":"added"},{"path":"src/revisions-tree.ts","added":10,"removed":0,"status":"added"},{"path":"tsconfig.json","added":22,"removed":0,"status":"added"}]}',
      ),
    );

    expect(result).toEqual({
      changeId: ChangeIdSchema.make("yytmpmlpuwlwmtmqznpzntyopzusputn"),
      description: "Bare minimum\n",
      parentChangeIds: [
        ChangeIdSchema.make("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
      ],
      isCurrentCopy: false,
      isConflict: false,
      files: [
        {
          path: ".gitignore",
          added: 3,
          removed: 0,
          status: "added",
        },
        {
          path: ".vscodeignore",
          added: 12,
          removed: 0,
          status: "added",
        },
        {
          path: "AGENTS.md",
          added: 0,
          removed: 0,
          status: "added",
        },
        {
          path: "LICENSE",
          added: 7,
          removed: 0,
          status: "added",
        },
        {
          path: "README.md",
          added: 10,
          removed: 0,
          status: "added",
        },
        {
          path: "media/icon.svg",
          added: 3,
          removed: 0,
          status: "added",
        },
        {
          path: "package.json",
          added: 49,
          removed: 0,
          status: "added",
        },
        {
          path: "pnpm-lock.yaml",
          added: 2620,
          removed: 0,
          status: "added",
        },
        {
          path: "pnpm-workspace.yaml",
          added: 4,
          removed: 0,
          status: "added",
        },
        {
          path: "src/extension.ts",
          added: 25,
          removed: 0,
          status: "added",
        },
        {
          path: "src/revisions-tree.ts",
          added: 10,
          removed: 0,
          status: "added",
        },
        {
          path: "tsconfig.json",
          added: 22,
          removed: 0,
          status: "added",
        },
      ],
    });
  });

  it("reads the root revision with no files", () => {
    const result = Effect.runSync(
      parseJjLogLine(
        '{"commit_id":"0000000000000000000000000000000000000000","parents":[],"change_id":"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz","description":"","author":{"name":"","email":"","timestamp":"1970-01-01T00:00:00Z"},"committer":{"name":"","email":"","timestamp":"1970-01-01T00:00:00Z"},"parentChangeIds":[],"isCurrentCopy":false,"isConflict":false,"files":[]}',
      ),
    );

    expect(result).toEqual({
      changeId: ChangeIdSchema.make("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
      description: "",
      parentChangeIds: [],
      isCurrentCopy: false,
      isConflict: false,
      files: [],
    });
  });
});
