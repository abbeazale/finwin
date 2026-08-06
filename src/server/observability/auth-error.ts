import { randomUUID } from "node:crypto";

type AuthLogLevel = "debug" | "info" | "warn" | "error";

export type AuthErrorEvent = {
  operation: "better-auth";
  correlationId: string;
  severity: "warn" | "error";
  eventCode: string;
};

function classifyAuthEvent(message: string) {
  if (message.includes("Invalid callbackURL")) return "INVALID_CALLBACK_URL";
  if (message.includes("Invalid origin")) return "INVALID_ORIGIN";
  if (message.includes("low-entropy")) return "LOW_ENTROPY_SECRET";
  if (message.includes("Provider not found")) return "PROVIDER_NOT_FOUND";
  return "INTERNAL_ERROR";
}

export function createBetterAuthLogger(
  logger: (event: AuthErrorEvent) => void = console.error,
) {
  return {
    level: "warn" as const,
    log(level: AuthLogLevel, message: string, ...unsafeDetails: unknown[]) {
      void unsafeDetails;
      if (level !== "warn" && level !== "error") return;
      logger({
        operation: "better-auth",
        correlationId: randomUUID(),
        severity: level,
        eventCode: classifyAuthEvent(message),
      });
    },
  };
}
