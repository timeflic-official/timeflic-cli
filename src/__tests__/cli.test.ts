import { examples } from '../schema.js';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../commands/init.js';
import { main } from '../main.js';
import { isValidCron, schemaErrors, validateManifest } from '../manifest-validator.js';

const template = (name: string) => structuredClone(examples[name]!);

describe('validateManifest', () => {
  it('accepts every template', () => {
    expect(TEMPLATES).toEqual(['hr-attendance', 'leave-assistant', 'payroll-review', 'task-triage']);
    for (const name of TEMPLATES) expect(validateManifest(template(name)), name).toEqual([]);
  });

  it('reports schema problems first', () => {
    const problems = validateManifest({ ...template('leave-assistant'), slug: 'Bad Slug', version: '1' });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/slug/);
    expect(schemaErrors({})).not.toEqual([]);
  });

  it('applies the TimeFlic rules the catalog sync applies', () => {
    const manifest = {
      ...template('leave-assistant'),
      tools: ['leave.requests.list', 'nope.tool', 'payroll.periods.approve_all', 'tasks.comments.create'],
      permissions: { 'leave.view_all': 'Reads leave requests for the team.', 'tasks.view_all': 'Answers mentions in task comments.', 'team.view': 'Not needed by any tool here.' },
      tiers: { 'payroll.periods.approve_all': 'write' },
      triggers: [
        { type: 'event', event: 'made.up' },
        { type: 'schedule', cron: '* * * * *', name: 'too often' },
      ],
      pricing: { monthly: 1, yearly: 100 },
    };
    const joined = validateManifest(manifest).join('\n');
    expect(joined).toContain("'nope.tool' is not a TimeFlic tool");
    expect(joined).toContain("needs 'payroll.approve_items'");
    expect(joined).toContain("'team.view' is requested but no listed tool needs it");
    expect(joined).toContain('cannot be lowered to write');
    expect(joined).toContain("unknown event 'made.up'");
    expect(joined).toContain('more often than every 15 minutes');
    expect(joined).toContain('yearly cannot cost more than twelve months');
  });

  it('checks cron spacing', () => {
    expect(isValidCron('0 9 * * 1-5')).toBe(true);
    expect(isValidCron('*/15 * * * *')).toBe(true);
    expect(isValidCron('*/5 * * * *')).toBe(false);
    expect(isValidCron('not a cron')).toBe(false);
  });
});

describe('main', () => {
  it('validates a file, lists tools and refuses portal commands for now', async () => {
    const lines: string[] = [];
    const out = (line: string) => lines.push(line);
    const dir = mkdtempSync(join(tmpdir(), 'timeflic-cli-'));
    const file = join(dir, 'leave.json');
    writeFileSync(file, JSON.stringify(template('leave-assistant')));
    expect(await main(['agent', 'validate', file], out)).toBe(0);
    expect(await main(['agent', 'tools', '--search', 'leave'], out)).toBe(0);
    expect(lines.join('\n')).toContain('leave.requests.approve');
    expect(await main(['agent', 'submit'], out)).toBe(2);
    expect(await main(['login'], out)).toBe(2);
    expect(await main(['agent', 'nonsense'], out)).toBe(1);
    expect(await main(['nonsense'], out)).toBe(1);
    expect(await main([], out)).toBe(0);
    expect(await main(['agent'], out)).toBe(0);
  });

  it('points type-less agent commands at the agent group', async () => {
    const lines: string[] = [];
    expect(await main(['init', 'leave-assistant'], (line) => lines.push(line))).toBe(1);
    expect(lines[0]).toContain('timeflic agent init leave-assistant');
  });
});

describe('init and --version', () => {
  it('writes a template once and refuses to overwrite it', async () => {
    const lines: string[] = [];
    const out = (line: string) => lines.push(line);
    const target = join(mkdtempSync(join(tmpdir(), 'timeflic-cli-')), 'agent.json');
    expect(await main(['agent', 'init', 'task-triage', '--out', target], out)).toBe(0);
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual(examples['task-triage']);
    expect(await main(['agent', 'validate', target], out)).toBe(0);
    expect(await main(['agent', 'init', 'task-triage', '--out', target], out)).toBe(1);
    expect(await main(['agent', 'init', 'not-a-template'], out)).toBe(1);
    expect(lines.join('\n')).toContain('Templates: hr-attendance, leave-assistant, payroll-review, task-triage');
  });

  it('prints the package version and the schema date', async () => {
    const lines: string[] = [];
    expect(await main(['--version'], (line) => lines.push(line))).toBe(0);
    expect(lines[0]).toMatch(/^@timeflic\/cli \d+\.\d+\.\d+\S* · schema synced \d{4}-\d{2}-\d{2}T/);
  });
});
