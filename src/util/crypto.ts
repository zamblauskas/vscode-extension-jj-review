import { Schema } from "effect";
import { createHash } from "node:crypto";

export function hash(value: Schema.Json) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
