import type { IncomingMessage } from "node:http";

export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(maxBytes: number = MAX_WEBHOOK_BODY_BYTES) {
    super(`Request body exceeds ${maxBytes} bytes.`);
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Read a raw HTTP body while enforcing a hard byte limit.
 * Stops reading and destroys the request as soon as the limit is exceeded so
 * the process cannot be forced to buffer an unbounded payload.
 */
export async function readBoundedRawBody(
  req: IncomingMessage,
  maxBytes: number = MAX_WEBHOOK_BODY_BYTES,
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      req.destroy();
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}
