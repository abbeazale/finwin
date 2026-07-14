import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import {
  MAX_WEBHOOK_BODY_BYTES,
  RequestBodyTooLargeError,
  readBoundedRawBody,
} from "./raw-body";

describe("readBoundedRawBody", () => {
  test("returns the exact utf8 body under the limit", async () => {
    const body = '{"webhook_type":"TRANSACTIONS"}';
    const req = Readable.from([Buffer.from(body)]);
    await expect(readBoundedRawBody(req)).resolves.toBe(body);
  });

  test("throws and stops when the byte limit is exceeded", async () => {
    const req = Readable.from([Buffer.alloc(200), Buffer.alloc(200)]);
    await expect(readBoundedRawBody(req, 256)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  test("default limit is 256 KiB", () => {
    expect(MAX_WEBHOOK_BODY_BYTES).toBe(256 * 1024);
  });
});
