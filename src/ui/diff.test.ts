import { Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ChangeIdSchema } from "../model/revision";
import { FsPathSchema } from "../model/fs-path";
import { ChangeIdPathFromUriSchema, JjReviewScheme } from "./diff";

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
  const changeId = ChangeIdSchema.make("qzsoyvxrknqvnrqkuywqqtvtnorklsmy");
  const path = FsPathSchema.make("src/foo.ts");

  it("decodes jjReview URIs", () => {
    const uri = vscode.Uri.from({
      scheme: JjReviewScheme,
      path,
      query: changeId,
    });

    expect(Schema.decodeUnknownSync(ChangeIdPathFromUriSchema)(uri)).toEqual({
      changeId,
      path,
    });
  });

  it("encodes change id and path into jjReview URIs", () => {
    const uri = Schema.encodeSync(ChangeIdPathFromUriSchema)({
      changeId,
      path,
    });

    expect(uri).toEqual(
      vscode.Uri.from({
        scheme: JjReviewScheme,
        path,
        query: changeId,
      }),
    );
  });

  it("round-trips encode and decode", () => {
    const uri = vscode.Uri.from({
      scheme: JjReviewScheme,
      path,
      query: changeId,
    });

    const decoded = Schema.decodeUnknownSync(ChangeIdPathFromUriSchema)(uri);
    const encoded = Schema.encodeSync(ChangeIdPathFromUriSchema)(decoded);

    expect(encoded).toEqual(uri);
  });

  it("rejects other schemes", () => {
    const uri = vscode.Uri.from({
      scheme: "file",
      path,
      query: changeId,
    });

    expect(() =>
      Schema.decodeUnknownSync(ChangeIdPathFromUriSchema)(uri),
    ).toThrow();
  });
});
