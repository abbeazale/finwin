import type { IncomingHttpHeaders } from "http";

export function toRequestHeaders(headers: IncomingHttpHeaders) {
  const requestHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      requestHeaders.set(key, value.join(", "));
      continue;
    }

    if (value !== undefined) {
      requestHeaders.set(key, value);
    }
  }

  return requestHeaders;
}
