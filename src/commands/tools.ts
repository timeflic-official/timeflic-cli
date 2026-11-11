import { tools as reference } from '../schema.js';

/** `timeflic agent tools [--search text] [--json]`: the tools an agent may call. */
export function tools(args: string[], out: (line: string) => void): number {
  const searchIndex = args.indexOf('--search');
  const needle = searchIndex >= 0 ? (args[searchIndex + 1] ?? '').toLowerCase() : '';
  const rows = reference.tools.filter((tool) => needle === '' || `${tool.name} ${tool.description} ${tool.permission}`.toLowerCase().includes(needle));
  if (args.includes('--json')) {
    out(JSON.stringify(rows, null, 2));
    return 0;
  }
  const width = Math.max(...rows.map((tool) => tool.name.length), 4);
  out(`${'tool'.padEnd(width)}  tier      permission`);
  for (const tool of rows) out(`${tool.name.padEnd(width)}  ${tool.tier.padEnd(8)}  ${tool.permission}  — ${tool.description}`);
  out('');
  out(`${rows.length} tool${rows.length === 1 ? '' : 's'} · synced ${reference.synced_at} · events: ${reference.events.map((event) => event.name).join(', ')}`);
  return 0;
}
