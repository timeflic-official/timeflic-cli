import manifestSchema from '../schema/agent-manifest.v1.json' with { type: 'json' };
import toolsReference from '../schema/tools.json' with { type: 'json' };
import hrAttendance from '../schema/examples/hr-attendance.manifest.json' with { type: 'json' };
import leaveAssistant from '../schema/examples/leave-assistant.manifest.json' with { type: 'json' };
import payrollReview from '../schema/examples/payroll-review.manifest.json' with { type: 'json' };
import taskTriage from '../schema/examples/task-triage.manifest.json' with { type: 'json' };

/**
 * TimeFlic's agent manifest schema, tools reference and example manifests. The JSON files
 * in schema/ are downloaded from TimeFlic (`pnpm sync:schema`), never edited by hand; the
 * build bundles them, so each CLI version checks against one fixed copy.
 */

export type Tier = 'read' | 'write' | 'critical';

export interface ToolReference {
  name: string;
  description: string;
  tier: Tier;
  permission: string;
  input_schema: Record<string, unknown>;
}

export interface ToolsReference {
  synced_at: string;
  source: string;
  tools: ToolReference[];
  tiers: Tier[];
  events: { name: string; label: string }[];
  schema: string;
}

export const MANIFEST_SCHEMA_ID = 'https://developers.timeflic.com/schemas/agent/v1.json';

export const manifestSchemaV1 = manifestSchema as Record<string, unknown>;
export const tools = toolsReference as unknown as ToolsReference;

/** The example manifests, keyed by the template name `timeflic agent init` takes. */
export const examples: Readonly<Record<string, Record<string, unknown>>> = {
  'hr-attendance': hrAttendance,
  'leave-assistant': leaveAssistant,
  'payroll-review': payrollReview,
  'task-triage': taskTriage,
};
