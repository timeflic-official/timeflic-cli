import { init, TEMPLATES } from './commands/init.js';
import { tools } from './commands/tools.js';
import { validate } from './commands/validate.js';
import { version } from './version.js';

/**
 * `timeflic <type> <command>`: one CLI for everything a developer builds for TimeFlic.
 * Agents are the first add-on type; a new type gets its own `timeflic <type> ...` group
 * next to `agent`, and account commands (login, sandbox) stay at the top level.
 */
const HELP = `timeflic — build, check and submit add-ons for TimeFlic

Usage: timeflic <type> <command> [options]

Agents (AI agents that run inside TimeFlic)
  agent init <template> [--out file]    start from a template (${TEMPLATES.join(', ')})
  agent validate [file]                 check a manifest offline (schema + TimeFlic rules)
  agent tools [--search text] [--json]  list the tools an agent may call

Coming with the Developer Portal
  login | logout | whoami | sandbox     your Developer Portal account and sandboxes
  agent test | submit | status          run in the sandbox, submit for review, follow it
  agent releases | rollback <version>   published versions

  --version                             CLI version and the date of the schema it checks against
  help                                  this help
`;

const AGENT_HELP = `timeflic agent — AI agents that run inside TimeFlic

  init <template> [--out file]    start from a template (${TEMPLATES.join(', ')})
  validate [file]                 check a manifest offline; default file timeflic-agent.json
  tools [--search text] [--json]  list the tools an agent may call, with tiers and permissions
  test | submit | status | releases | rollback   need the Developer Portal (not open yet)
`;

/** Top-level commands that need a Developer Portal account. */
const ACCOUNT_COMMANDS = new Set(['login', 'logout', 'whoami', 'sandbox']);
/** Agent commands that need the Developer Portal. */
const AGENT_PORTAL_COMMANDS = new Set(['test', 'submit', 'status', 'releases', 'rollback']);
/** Agent commands someone may type without the `agent` group. */
const AGENT_COMMANDS = new Set(['init', 'validate', 'tools', ...AGENT_PORTAL_COMMANDS]);

const portalNotOpen = (command: string) =>
  `${command}: this command talks to the TimeFlic Developer Portal, which is not open yet. Check a manifest locally with "timeflic agent validate" for now.`;

export async function main(argv: string[], out: (line: string) => void = console.log): Promise<number> {
  const [command, ...args] = argv;
  switch (command) {
    case 'agent':
      return agent(args, out);
    case '--version':
    case '-v':
    case 'version':
      out(version());
      return 0;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      out(HELP);
      return 0;
    default:
      if (ACCOUNT_COMMANDS.has(command)) {
        out(portalNotOpen(command));
        return 2;
      }
      if (AGENT_COMMANDS.has(command)) {
        out(`"${command}" belongs to a type. For an agent: timeflic agent ${[command, ...args].join(' ')}`);
        return 1;
      }
      out(`Unknown command "${command}".\n\n${HELP}`);
      return 1;
  }
}

async function agent(argv: string[], out: (line: string) => void): Promise<number> {
  const [command, ...args] = argv;
  switch (command) {
    case 'init':
      return init(args, out);
    case 'validate':
      return validate(args, out);
    case 'tools':
      return tools(args, out);
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      out(AGENT_HELP);
      return 0;
    default:
      if (AGENT_PORTAL_COMMANDS.has(command)) {
        out(portalNotOpen(`agent ${command}`));
        return 2;
      }
      out(`Unknown agent command "${command}".\n\n${AGENT_HELP}`);
      return 1;
  }
}
