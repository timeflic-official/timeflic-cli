#!/usr/bin/env node
// Fills the tools and events tables in README.md from the bundled tools reference
// (schema/tools.json), between the <!-- tools:start/end --> and
// <!-- events:start/end --> markers. Run by the build, so after `pnpm sync:schema`
// the README shipped to npm always lists exactly the tools the CLI validates against.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = join(root, 'README.md');
const reference = JSON.parse(readFileSync(join(root, 'schema', 'tools.json'), 'utf8'));

const AREA_TITLES = { tasks: 'Tasks', projects: 'Projects', team: 'Team', timesheet: 'Time', time_entries: 'Time', leave: 'Leave', payroll: 'Payroll', reports: 'Reports', hr: 'HR' };
const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

const groups = new Map();
for (const tool of reference.tools) {
  const area = AREA_TITLES[tool.name.split('.')[0]] ?? 'Other';
  if (!groups.has(area)) groups.set(area, []);
  groups.get(area).push(tool);
}
const toolsTable = [
  `${reference.tools.length} tools, taken from TimeFlic on ${reference.synced_at.slice(0, 10)}.`,
  '',
  '| Area | Tool | Tier | Needs permission | What it does |',
  '|---|---|---|---|---|',
  ...[...groups.entries()].flatMap(([area, tools]) => tools.map((tool, index) => `| ${index === 0 ? area : ''} | \`${tool.name}\` | ${tool.tier} | \`${tool.permission}\` | ${cell(tool.description)} |`)),
].join('\n');

const eventsTable = ['| Event | Fires when |', '|---|---|', ...reference.events.map((event) => `| \`${event.name}\` | ${cell(event.label)} |`)].join('\n');

function fill(text, name, body) {
  const pattern = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!pattern.test(text)) throw new Error(`README.md has no <!-- ${name}:start --> / <!-- ${name}:end --> markers`);
  return text.replace(pattern, `$1\n${body}\n$2`);
}

const before = readFileSync(readmePath, 'utf8');
const after = fill(fill(before, 'tools', toolsTable), 'events', eventsTable);
if (after !== before) writeFileSync(readmePath, after);
console.log(`README tables: ${reference.tools.length} tools, ${reference.events.length} events${after === before ? ' (unchanged)' : ' (updated)'}`);
