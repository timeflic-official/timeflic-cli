# Changelog

Releases of `@timeflic/cli`. Each version is published by pushing the tag `v<version>`; see `RELEASING.md`.

## 0.1.1

Documentation only; the commands and the rules they check are unchanged.

- A full guide on the npm page: what an agent is and how a run works, a step-by-step first agent, every manifest field with its limits, tools, permissions and tiers, triggers and the event list, commands and exit codes, every `validate` message with its fix, the rules every agent runs under, CI and troubleshooting.
- The tools and events tables are generated from the bundled tools reference, so they always match what `validate` checks.
- `CHANGELOG.md` now ships in the package.
- The source is public at https://github.com/timeflic-official/timeflic-cli, and releases are built there with npm provenance.

## 0.1.0

First public release of the TimeFlic developer CLI. Works offline; nothing to sign in to yet.

- `timeflic agent init <template>`: start from one of four working agent manifests (`hr-attendance`, `leave-assistant`, `payroll-review`, `task-triage`).
- `timeflic agent validate [file]`: the manifest schema plus the rules TimeFlic applies on submit.
- `timeflic agent tools [--search text] [--json]`: the tools an agent may call, with tiers and permissions.
- `timeflic --version`: CLI version and the date of the bundled schema.
- One bundled file, no dependencies, Node.js 20 or newer.

Replaces `@timeflic/agent-cli` 0.1.0 (published briefly on 2026-11-11, then withdrawn): the CLI is named for all add-on types, with agents as the first group.
