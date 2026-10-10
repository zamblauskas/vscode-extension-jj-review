import { Option, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ChangeIdSchema } from "../model/revision";
import { FsPathSchema } from "../model/fs-path";
import { ChangeIdPathFromUriSchema, JjReviewScheme } from "./uri";

vi.mock("vscode", () => {
  class Uri {
    readonly scheme: string;
    readonly path: string;
    readonly query: string;

    private constructor(scheme: string, path: string, query: string) {
      this.scheme = scheme;
      this.path = path;
      this.query = query;
    }

    static from(components: {
      readonly scheme: string;
      readonly path?: string;
      readonly query?: string;
    }): Uri {
      return new Uri(
        components.scheme,
        components.path ?? "",
        components.query ?? "",
      );
    }
  }

  return { Uri };
});

import * as vscode from "vscode";

describe("ChangeIdPathFromUriSchema", () => {
  const changeId = ChangeIdSchema.make("some-change-id");
  const path = FsPathSchema.make("src/foo.ts");

  const decoded = {
    path,
    query: { side: "left" as const, changeId: Option.some(changeId) },
  };

  it("decodes jjReview URIs", () => {
    const uri = Schema.encodeSync(ChangeIdPathFromUriSchema)(decoded);

    expect(Schema.decodeUnknownSync(ChangeIdPathFromUriSchema)(uri)).toEqual(
      decoded,
    );
  });

  it("encodes path, side, and change id into jjReview URIs", () => {
    const uri = Schema.encodeSync(ChangeIdPathFromUriSchema)(decoded);

    expect(uri).toEqual(
      vscode.Uri.from({
        scheme: JjReviewScheme,
        path,
        query: new URLSearchParams({
          side: "left",
          changeId,
        }).toString(),
      }),
    );
  });

  it("round-trips encode and decode", () => {
    const uri = Schema.encodeSync(ChangeIdPathFromUriSchema)(decoded);
    const roundTripped = Schema.encodeSync(ChangeIdPathFromUriSchema)(
      Schema.decodeUnknownSync(ChangeIdPathFromUriSchema)(uri),
    );

    expect(roundTripped).toEqual(uri);
  });

  it("rejects other schemes", () => {
    const uri = vscode.Uri.from({
      scheme: "file",
      path,
      query: new URLSearchParams({
        side: "left",
        changeId,
      }).toString(),
    });

    expect(() =>
      Schema.decodeUnknownSync(ChangeIdPathFromUriSchema)(uri),
    ).toThrow();
  });
});
