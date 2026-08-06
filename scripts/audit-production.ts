import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";

const severitySchema = z.enum(["low", "moderate", "high", "critical"]);
const advisorySchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  severity: severitySchema,
});
const auditSchema = z.record(z.string(), z.array(advisorySchema));
const exceptionSchema = z.object({
  advisory: z.string().regex(/^GHSA-[a-z0-9-]+$/),
  package: z.string().min(1),
  severity: severitySchema,
  owner: z.string().min(1),
  expires: z.string().date(),
  evidence: z.string().min(20),
  compensatingControl: z.string().min(20),
});
const exceptionsSchema = z.array(exceptionSchema);

const exceptionsPath = resolve(process.cwd(), "config/audit-exceptions.json");
const exceptions = exceptionsSchema.parse(
  JSON.parse(readFileSync(exceptionsPath, "utf8")),
);
const audit = spawnSync("bun", ["audit", "--prod", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (audit.error) throw audit.error;
if (!audit.stdout.trim()) {
  throw new Error(`bun audit returned no JSON.\n${audit.stderr.trim()}`);
}

const findings = auditSchema.parse(JSON.parse(audit.stdout));
const activeFindings = Object.entries(findings).flatMap(([packageName, advisories]) =>
  advisories.map((advisory) => ({
    ...advisory,
    package: packageName,
    advisory: advisory.url.split("/").at(-1) ?? "",
  })),
);
const today = new Date().toISOString().slice(0, 10);
const failures: string[] = [];

for (const exception of exceptions) {
  if (exception.expires < today) {
    failures.push(`${exception.advisory} expired on ${exception.expires}.`);
  }
  const finding = activeFindings.find((item) => item.advisory === exception.advisory);
  if (!finding) {
    failures.push(`${exception.advisory} is no longer reported; remove its stale exception.`);
  } else if (finding.package !== exception.package || finding.severity !== exception.severity) {
    failures.push(`${exception.advisory} no longer matches its recorded package/severity.`);
  }
}

for (const finding of activeFindings) {
  if (!exceptions.some((exception) => exception.advisory === finding.advisory)) {
    failures.push(
      `${finding.severity} ${finding.package} ${finding.advisory} is not patched or explicitly excepted.`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Production audit policy failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Production audit policy passed: ${activeFindings.length} finding(s), ${exceptions.length} active exception(s).`,
);
