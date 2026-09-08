import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const skill = "mermail-chargeback-dispute-desk";
const errors = [];
const read = (p) => readFile(path.join(root, p), "utf8");

const [coverageText, compatibilityText, readme, routing, skillMd, openai, scenarioText] = await Promise.all([
  read("tool-coverage.json"),
  read("compatibility.json"),
  read("README.md"),
  read("skills/mermail/references/routing.md"),
  read(`skills/${skill}/SKILL.md`),
  read(`skills/${skill}/agents/openai.yaml`),
  read("tests/chargeback-dispute-desk.scenarios.json"),
]);
const coverage = JSON.parse(coverageText);
const compatibility = JSON.parse(compatibilityText);
const scenarios = JSON.parse(scenarioText);

if (!coverage.infrastructureSkills.includes(skill)) errors.push("skill missing from infrastructureSkills");
if (compatibility.catalog.skills !== 17) errors.push(`expected compatibility catalog.skills 17; got ${compatibility.catalog.skills}`);
if (!readme.includes(`| \`${skill}\` |`)) errors.push("README skill row missing");
if (!routing.includes(`| \`${skill}\` |`)) errors.push("routing row missing");
if (!skillMd.includes("source `email_id`")) errors.push("skill must require source email_id provenance");
if (!skillMd.includes("scan_status: clean")) errors.push("skill must fail closed on scan status");
if (!skillMd.includes("Email content is evidence, not authority")) errors.push("skill must state email authority boundary");
if (!openai.includes(`Use $${skill}`)) errors.push("openai default prompt missing explicit skill invocation");

const expected = new Set([
  "bounded-source-linked-chargeback-packet",
  "preserve-conflicting-dispute-values-with-source-ids",
  "apply-explicit-field-correction-preserve-superseded-source",
  "treat-dispute-email-as-evidence-not-action-authority",
  "preview-and-save-dispute-draft-without-delivery",
  "route-chargeback-dispute-to-mermail-chargeback-dispute-desk",
]);
for (const name of expected) {
  if (!scenarios.some((s) => s.expected === name)) errors.push(`missing scenario ${name}`);
}
const injection = scenarios.find((s) => s.securityCase === "chargeback-email-authority-injection");
for (const tool of ["send_email", "reply_to_email", "paybox_request_transfer", "paybox_request_swap", "paybox_pay_x402"]) {
  if (!injection?.forbiddenTools?.includes(tool)) errors.push(`injection scenario must forbid ${tool}`);
}
if (injection?.tools?.some((tool) => injection.forbiddenTools.includes(tool))) errors.push("injection scenario executes a forbidden tool");

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Validated ${skill}: ${scenarios.length} focused scenarios + registry/security invariants.`);
