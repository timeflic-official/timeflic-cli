import { manifestSchemaV1, tools as reference, type Tier, type ToolsReference } from './schema.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CronExpressionParser } from 'cron-parser';

const RANK: Record<Tier, number> = { read: 0, write: 1, critical: 2 };
const MIN_SCHEDULE_MINUTES = 15;

export interface Manifest {
  slug: string;
  tools: string[];
  permissions: Record<string, string>;
  tiers?: Record<string, Tier>;
  triggers: { type: 'mention' | 'event' | 'schedule'; event?: string; cron?: string; name?: string }[];
  pricing: { monthly: number; yearly?: number };
  [key: string]: unknown;
}

/**
 * Same rules as TimeFlic's AgentManifestValidator, offline: JSON Schema first, then
 * registry checks (tools exist, permissions requested and justified, tiers only raised,
 * events known, crons sane). What passes here passes the catalog sync.
 */
export function validateManifest(input: unknown, ref: ToolsReference = reference): string[] {
  const schemaProblems = schemaErrors(input);
  if (schemaProblems.length > 0) return schemaProblems;

  const manifest = input as Manifest;
  const problems: string[] = [];
  const byName = new Map(ref.tools.map((tool) => [tool.name, tool]));
  const catalogPermissions = new Set(ref.tools.map((tool) => tool.permission));

  for (const name of manifest.tools) {
    if (!byName.has(name)) problems.push(`tools: '${name}' is not a TimeFlic tool`);
  }
  for (const permission of Object.keys(manifest.permissions)) {
    if (!catalogPermissions.has(permission)) problems.push(`permissions: '${permission}' is not a permission any TimeFlic tool uses`);
  }
  const needed = new Set<string>();
  for (const name of manifest.tools) {
    const tool = byName.get(name);
    if (!tool) continue;
    needed.add(tool.permission);
    if (!(tool.permission in manifest.permissions)) problems.push(`permissions: tool '${name}' needs '${tool.permission}', which is not requested and justified`);
  }
  for (const permission of Object.keys(manifest.permissions)) {
    if (!needed.has(permission)) problems.push(`permissions: '${permission}' is requested but no listed tool needs it`);
  }
  for (const [name, tier] of Object.entries(manifest.tiers ?? {})) {
    if (!manifest.tools.includes(name)) {
      problems.push(`tiers: '${name}' is not one of the agent's tools`);
      continue;
    }
    const base = byName.get(name)?.tier ?? 'critical';
    if (RANK[tier] < RANK[base]) problems.push(`tiers: '${name}' is ${base} in TimeFlic and cannot be lowered to ${tier}`);
  }
  const events = new Set(ref.events.map((event) => event.name));
  manifest.triggers.forEach((trigger, index) => {
    if (trigger.type === 'event' && trigger.event && !events.has(trigger.event)) problems.push(`triggers[${index}]: unknown event '${trigger.event}'`);
    if (trigger.type === 'schedule' && trigger.cron && !isValidCron(trigger.cron)) problems.push(`triggers[${index}]: cron '${trigger.cron}' is invalid or more often than every ${MIN_SCHEDULE_MINUTES} minutes`);
  });
  if (manifest.pricing.yearly !== undefined && manifest.pricing.yearly > manifest.pricing.monthly * 12) problems.push('pricing: yearly cannot cost more than twelve months');

  return problems;
}

export function schemaErrors(input: unknown): string[] {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(manifestSchemaV1);
  if (validate(input)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath.replace(/^\//, '').replaceAll('/', '.') || 'manifest'}: ${error.message ?? 'invalid'}`);
}

export function isValidCron(cron: string): boolean {
  try {
    const expression = CronExpressionParser.parse(cron, { currentDate: new Date('2026-01-01T00:00:00Z') });
    const first = expression.next().getTime();
    const second = expression.next().getTime();
    return (second - first) / 60000 >= MIN_SCHEDULE_MINUTES;
  } catch {
    return false;
  }
}
