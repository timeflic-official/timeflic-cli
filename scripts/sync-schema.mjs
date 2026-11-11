#!/usr/bin/env node
// Download TimeFlic's agent manifest schema and tools reference into schema/, so the CLI
// checks manifests exactly the way TimeFlic does. The files are never edited by hand.
//
//   TIMEFLIC_API_URL=https://<timeflic api> pnpm sync:schema
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.TIMEFLIC_API_URL) {
  console.error('Set TIMEFLIC_API_URL to the TimeFlic API to download from (production for a release).');
  process.exit(1);
}
const base = process.env.TIMEFLIC_API_URL.replace(/\/$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', 'schema');

async function fetchJson(path) {
  const response = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

const schema = await fetchJson('/api/public/agents/manifest-schema/v1');
const tools = await fetchJson('/api/public/agents/tools');

await mkdir(root, { recursive: true });
await writeFile(resolve(root, 'agent-manifest.v1.json'), JSON.stringify(schema, null, 2) + '\n');
await writeFile(
  resolve(root, 'tools.json'),
  JSON.stringify({ synced_at: new Date().toISOString(), source: base, tools: tools.data, tiers: tools.meta.tiers, events: tools.meta.events, schema: tools.meta.schema }, null, 2) + '\n',
);
console.log(`Synced ${tools.data.length} tools and the manifest schema from ${base}`);
