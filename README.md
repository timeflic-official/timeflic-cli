# TimeFlic CLI

Build and check add-ons for [TimeFlic](https://timeflic.com), the workspace for time tracking, projects, HR and payroll. The first kind of add-on you can build is an **AI agent** that works inside a TimeFlic workspace: it checks leave requests, reviews payroll, triages tasks, or does whatever job you design it for.

```bash
npx @timeflic/cli agent init leave-assistant   # start from a working agent
npx @timeflic/cli agent validate               # check it the way TimeFlic will
```

**Contents:** [What you can build](#what-you-can-build) · [Requirements](#requirements) · [Quick start](#quick-start) · [Your first agent, step by step](#your-first-agent-step-by-step) · [The agent manifest](#the-agent-manifest) · [Tools, permissions and tiers](#tools-permissions-and-tiers) · [Triggers](#triggers) · [Commands](#commands) · [When validate fails](#when-validate-fails) · [Rules every agent runs under](#rules-every-agent-runs-under) · [Use it in CI](#use-it-in-ci) · [Troubleshooting](#troubleshooting) · [Versions](#versions)

---

## What you can build

Add-ons extend a TimeFlic workspace and are offered to TimeFlic customers in the Add-ons Store. Each add-on type has its own command group in this CLI: `timeflic <type> <command>`.

| Add-on type | What it is | Status | Commands |
|---|---|---|---|
| **Agent** | An AI agent that works inside a customer's workspace | Build and validate today; submitting opens with the TimeFlic Developer Portal | `timeflic agent …` |
| More types | | Planned | each gets its own group |

**An agent is a manifest, not a server.** You write one JSON file, `timeflic-agent.json`, that says:

- what the agent does (its instructions),
- which TimeFlic tools it may call and which permissions those need, with a reason for each,
- when it runs (an event, a schedule, or someone @mentioning it),
- how it appears in the Store and what it costs.

TimeFlic runs it. Models, hosting, limits, approvals and the audit trail are TimeFlic's job, so you write no backend and hold no API keys.

How a run works:

1. **Something happens:** an event (`leave.requested`), a schedule (weekdays at 09:00) or someone @mentioning the agent in a task comment.
2. **TimeFlic starts a run** with your instructions and the details of what happened, on a model of the tier you chose, within the limits you set.
3. **The agent acts** through the tools you listed. `read` and `write` tools run; `critical` ones wait until a person approves.
4. **Everything is recorded** as done by the agent, and the workspace owner can open each run and see its steps.

## Requirements

- **Node.js 20 or newer.** Check with `node --version`.
- Nothing else. Building and validating work offline, without an account.

## Quick start

```bash
mkdir my-agent && cd my-agent
npx @timeflic/cli agent init leave-assistant    # 1. writes timeflic-agent.json
                                                # 2. edit it (see the next section)
npx @timeflic/cli agent tools --search leave    # 3. look up the tools you need
npx @timeflic/cli agent validate                # 4. check it
```

```
timeflic-agent.json is valid.
```

Typing `npx @timeflic/cli` every time gets long. Install it once and use the `timeflic` command:

```bash
npm install -g @timeflic/cli
timeflic agent validate
```

## Your first agent, step by step

### 1. Start from a template

Every template is a complete agent that already passes `validate`, so you edit something that works instead of starting from an empty file.

| Template | What it does | Runs when | Model tier | Shows you how to |
|---|---|---|---|---|
| `leave-assistant` | Checks new leave requests against the policy and balance, approves the clear ones, explains the rest | `leave.requested` event, @mention, Mondays 09:00 | balanced | approve things, raise a tool's tier, charge a price |
| `hr-attendance` | A weekday-morning attendance summary from tracked time, with follow-ups | weekdays 09:00, @mention | balanced | read data and post a summary |
| `payroll-review` | A second look at each payroll period before anyone approves it | the 25th at 08:00, @mention | best | review and comment without changing payroll |
| `task-triage` | Suggests clearer titles, due dates and assignees on new tasks | `task.created` event, @mention | fast | edit tasks and comment on them |

```bash
timeflic agent init task-triage                       # writes timeflic-agent.json
timeflic agent init payroll-review --out payroll.json # or choose the file name
```

`init` never overwrites a file. If `timeflic-agent.json` already exists, pass `--out`.

### 2. Make it yours

Open `timeflic-agent.json` and change these first:

| Field | Change it to |
|---|---|
| `slug` | Your agent's permanent id: lowercase words joined by hyphens, like `overtime-watch`. It is unique across TimeFlic and cannot change after the first publish. |
| `name` | The name people see and @mention, like `Overtime Watch`. |
| `version` | `1.0.0` for the first release; raise it for every change you submit. |
| `capabilities` | What the agent is for, as `area.job` names (`hr.overtime`). TimeFlic's own assistant uses them to decide which work to hand to your agent. |
| `instructions` | The job, written to the model. See the tips below. |
| `listing` | The Store page: `summary`, `description`, `highlights`, `setup` steps, `category`, `icon`, `languages`. |

**Writing good instructions:**

- Say what to do on each trigger: "When a leave request comes in, …", "Every Monday, …", "When someone mentions you, …".
- Say what not to do and when to hand over to a person: "Never approve a request that exceeds the member's remaining balance."
- Describe the result you want: a comment, an approval, a summary, and how long it should be.
- Don't paste customer data or secrets. Instructions are shown in review.
- Text the agent reads from the workspace (task descriptions, comments) is handed to it as data, never as instructions. A comment cannot change what your agent is allowed to do.

### 3. Choose tools, then permissions

Find tools with `timeflic agent tools` (all of them) or `timeflic agent tools --search payroll`. Each tool has a **tier** and needs one **permission**:

```
tool                    tier      permission
leave.requests.list     read      leave.view_all  — List leave requests in the workspace.
leave.requests.approve  write     leave.approve  — Approve a pending leave request.
leave.balances.adjust   critical  leave.manage_balances  — Change a member's entitled or carried leave days.
```

Add the tool names to `tools`. Then, for every permission those tools need, add an entry to `permissions` with a plain sentence saying why. The workspace owner reads these sentences before installing.

```json
"tools": ["leave.requests.list", "leave.requests.approve"],
"permissions": {
  "leave.view_all": "Reads the leave requests it is asked about.",
  "leave.approve": "Approves requests that match the workspace policy; anything else is left to a person."
}
```

`validate` checks that both sides match: every tool's permission is listed, and nothing extra is.

### 4. Decide when it runs

Add one or more `triggers`:

```json
"triggers": [
  { "type": "event", "event": "leave.requested" },
  { "type": "schedule", "cron": "0 9 * * 1", "name": "Weekly leave summary" },
  { "type": "mention" }
]
```

Details and the full event list are under [Triggers](#triggers).

### 5. Set limits and a price

```json
"limits":  { "max_steps": 8, "max_tool_calls": 12 },
"pricing": { "monthly": 9, "yearly": 90, "trial_days": 14 }
```

`"monthly": 0` makes the agent free. Keep `limits` as low as the job allows; a run that hits them stops with a summary of what it did.

### 6. Validate

```bash
timeflic agent validate
```

Exit code `0` means TimeFlic would accept the manifest as it is. Anything else prints each problem on its own line; see [When validate fails](#when-validate-fails).

### 7. Submit (coming soon)

When the TimeFlic Developer Portal opens: `timeflic login`, then `timeflic agent test` to run it in a sandbox workspace, and `timeflic agent submit` to send it for review. Approved agents are published in the Add-ons Store.

## The agent manifest

`timeflic-agent.json` follows the JSON Schema at `https://developers.timeflic.com/schemas/agent/v1.json` (bundled in this CLI). Fields not listed here are rejected.

| Field | Required | What it is | Rules |
|---|---|---|---|
| `schema` | yes | The schema this file follows | exactly `https://developers.timeflic.com/schemas/agent/v1.json` |
| `slug` | yes | Permanent unique id | 3–60 characters, lowercase letters, digits, single hyphens, starts with a letter |
| `name` | yes | Display name, also the @mention name | 2–60 characters |
| `version` | yes | This version of the agent | `MAJOR.MINOR.PATCH`, like `1.2.0` |
| `capabilities` | yes | Jobs TimeFlic's assistant can hand to this agent | 1–10 names like `hr.leave` |
| `model_tier` | yes | How capable a model to use | `fast`, `balanced` or `best`; TimeFlic picks the actual model |
| `instructions` | yes | The agent's job, written to the model | 20–12,000 characters |
| `tools` | yes | TimeFlic tools it may call | 1–40 names from `timeflic agent tools`, no duplicates |
| `permissions` | yes | Permission → why the agent needs it | 1–40 entries, each reason 10–300 characters |
| `triggers` | yes | When it runs | 1–15 triggers; see [Triggers](#triggers) |
| `tiers` | no | Make a tool stricter for this agent | tool → `write` or `critical`; never lower than TimeFlic's tier |
| `limits` | no | Per-run limits | `max_steps` 1–12, `max_tool_calls` 1–20 |
| `connections` | no | Outside services TimeFlic connects for it | `slack`, `google_calendar`; up to 5 |
| `pricing` | yes | What it costs | `monthly` 0–999 (required); `yearly` 0–9,999 and no more than 12 × monthly; `trial_days` 0–30; `included_tokens` up to 50,000,000 |
| `data_handling` | yes | What it reads and stores, shown on the listing | 20–1,000 characters |
| `listing` | yes | The Store page | see below |

`listing` fields:

| Field | Required | Rules |
|---|---|---|
| `summary` | yes | One line, 10–140 characters |
| `description` | yes | 50–5,000 characters |
| `category` | no | `finance`, `hr`, `monitoring`, `automation`, `analytics` or `security` |
| `icon` | no | An emoji, used until you upload a logo in the Developer Portal |
| `languages` | no | Languages it works in, as codes: `en`, `bn`, `pt-BR` (1–10) |
| `highlights` | no | 1–5 short lines about what it does |
| `setup` | no | 1–6 getting-started steps shown after install |
| `docs_url` | no | Your documentation, `https://` only |
| `screenshots` | no | Ignored here; upload screenshots in the Developer Portal |

## Tools, permissions and tiers

**Three fences, and the narrowest wins.** An agent can do something only if:

1. the tool is in its `tools` list,
2. the tool's permission is in its `permissions`, and
3. the role the workspace owner gives it at install grants that permission.

The owner sees every permission with your reason before installing and can give the agent a role with less.

**Tiers decide who has to agree:**

| Tier | Examples | By default | The owner can |
|---|---|---|---|
| `read` | list leave requests, read a timesheet | runs | (always runs) |
| `write` | approve leave within policy, comment, update a task | runs | require approval |
| `critical` | approve a payroll period, adjust balances, deactivate a member, delete | waits for approval in the owner's Inbox | allow it without approval, with a daily cap |

Use `tiers` to make a tool stricter for your agent, for example `"leave.requests.approve": "critical"` so every approval waits for a person. You can raise a tier but never lower it.

### All tools

<!-- tools:start -->
27 tools, taken from TimeFlic on 2026-11-04.

| Area | Tool | Tier | Needs permission | What it does |
|---|---|---|---|---|
| Tasks | `tasks.list` | read | `tasks.view_all` | List tasks in the workspace. Filter by status, priority, project, assignee or sprint; paginated. |
|  | `tasks.get` | read | `tasks.view_all` | Read one task with its details, assignees and status. |
|  | `tasks.create` | write | `tasks.create` | Create a task in a project. |
|  | `tasks.update` | write | `tasks.edit` | Update a task: title, description, status, priority, due date. |
|  | `tasks.delete` | critical | `tasks.delete` | Delete a task. Irreversible. |
|  | `tasks.assignees.toggle` | write | `tasks.assign` | Add or remove an assignee on a task. |
|  | `tasks.comments.list` | read | `tasks.view_all` | Read the comments on a task. |
|  | `tasks.comments.create` | write | `tasks.view_all` | Post a comment on a task, optionally assigned to a member as an action item. |
| Projects | `projects.list` | read | `projects.view` | List projects in the workspace. |
|  | `projects.get` | read | `projects.view` | Read one project. |
| Team | `team.list` | read | `team.view` | List workspace members with role and status. |
|  | `team.get` | read | `team.view` | Read one member. |
|  | `team.deactivate` | critical | `team.activate_members` | Deactivate a member: they lose access until reactivated. |
| Time | `timesheet.list` | read | `timesheet.view_team` | Time entries for a date range, optionally one project; paginated. |
|  | `timesheet.summary` | read | `timesheet.view_team` | Hours totals for a date range. |
|  | `time_entries.create` | write | `time_entries.create` | Create a finished time entry with notes, start and end. |
| Leave | `leave.requests.list` | read | `leave.view_all` | List leave requests in the workspace. |
|  | `leave.requests.approve` | write | `leave.approve` | Approve a pending leave request. |
|  | `leave.requests.reject` | write | `leave.approve` | Reject a pending leave request with a reason. |
|  | `leave.balances.list` | read | `leave.manage_balances` | Leave balances of every member. |
|  | `leave.balances.adjust` | critical | `leave.manage_balances` | Change a member's entitled or carried leave days. |
| Payroll | `payroll.summary` | read | `payroll.view_all` | Payroll dashboard summary. |
|  | `payroll.periods.list` | read | `payroll.view_all` | List payroll periods and their status. |
|  | `payroll.periods.approve_all` | critical | `payroll.approve_items` | Approve every item in a payroll period. |
|  | `payroll.periods.mark_all_paid` | critical | `payroll.mark_paid` | Mark every item in a payroll period as paid. |
| Reports | `reports.team_summary` | read | `reports.view_team` | Team time report summary for a date range. |
| HR | `hr.overview` | read | `leave.view_all` | HR hub overview: headcount, leave today, pending requests. |
<!-- tools:end -->

`timeflic agent tools --json` prints the same list with each tool's input schema.

## Triggers

| Type | Fields | Runs when |
|---|---|---|
| `mention` | none | someone @mentions the agent in a task comment; it replies in the thread |
| `event` | `event`: an event name from the list below | that thing happens in the workspace |
| `schedule` | `cron`, `name` | on a schedule, in the workspace's time zone |

**Schedules** use five-field cron (`minute hour day-of-month month day-of-week`) and may run at most every 15 minutes. `name` is what the owner sees and can pause.

| Cron | Means |
|---|---|
| `0 9 * * 1-5` | weekdays at 09:00 |
| `0 9 * * 1` | Mondays at 09:00 |
| `0 8 25 * *` | the 25th of every month at 08:00 |
| `*/30 * * * *` | every 30 minutes |

**Events** an agent can subscribe to:

<!-- events:start -->
| Event | Fires when |
|---|---|
| `task.created` | A task was created |
| `task.updated` | A task was edited |
| `task.status_changed` | A task changed status |
| `task.completed` | A task was completed |
| `task.group_changed` | A task moved to another team |
| `leave.requested` | A member requested leave |
| `leave.approved` | A leave request was approved |
| `leave.rejected` | A leave request was rejected |
| `time_entry.submitted` | A time entry or week was submitted for review |
<!-- events:end -->

An event tells the agent *what* happened (ids only). The agent reads the details through its tools, so it only ever sees what its permissions allow.

## Commands

| Command | What it does |
|---|---|
| `timeflic agent init <template> [--out file]` | Writes a template to `timeflic-agent.json` (or `file`). Never overwrites. Without a template, lists them. |
| `timeflic agent validate [file]` | Checks a manifest (default `timeflic-agent.json`) against the schema and TimeFlic's rules. |
| `timeflic agent tools [--search text] [--json]` | Lists the tools with tier and permission, and the events. `--search` filters by name, description or permission; `--json` adds input schemas. |
| `timeflic --version` | The CLI version and the date its schema and tools were taken from TimeFlic. |
| `timeflic help`, `timeflic agent help` | Usage. |

Coming with the Developer Portal: `timeflic login`, `logout`, `whoami`, `sandbox`, and `timeflic agent test`, `submit`, `status`, `releases`, `rollback`. Today they explain that the Portal is not open yet.

**Exit codes:** `0` success · `1` invalid manifest, unreadable file or wrong usage · `2` the command needs the Developer Portal.

## When validate fails

Each problem is one line that starts with the field it is about:

```
timeflic-agent.json has 5 problems:
  - permissions: tool 'payroll.periods.approve_all' needs 'payroll.approve_items', which is not requested and justified
  - permissions: 'team.view' is requested but no listed tool needs it
  - tiers: 'payroll.periods.approve_all' is critical in TimeFlic and cannot be lowered to write
  - triggers[3]: cron '*/5 * * * *' is invalid or more often than every 15 minutes
  - triggers[4]: unknown event 'leave.cancelled'
```

Shape problems (a missing field, a wrong format) are reported first, and the TimeFlic rules are checked once the shape is right:

```
timeflic-agent.json has 2 problems:
  - slug: must match pattern "^[a-z][a-z0-9]*(-[a-z0-9]+)*$"
  - version: must match pattern "^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$"
```

| Message | Fix |
|---|---|
| `tools: 'x' is not a TimeFlic tool` | Check the spelling with `timeflic agent tools --search`. |
| `permissions: tool 'x' needs 'p', which is not requested and justified` | Add `"p": "why the agent needs it"` to `permissions`. |
| `permissions: 'p' is requested but no listed tool needs it` | Remove it; ask only for what your tools use. |
| `permissions: 'p' is not a permission any TimeFlic tool uses` | Remove it or fix the spelling. |
| `tiers: 'x' is not one of the agent's tools` | Add the tool to `tools` or remove the tier. |
| `tiers: 'x' is critical in TimeFlic and cannot be lowered to write` | Remove the entry; tiers can only be raised. |
| `triggers[n]: unknown event 'e'` | Use an event from the [list](#triggers). `n` counts from 0. |
| `triggers[n]: cron '…' is invalid or more often than every 15 minutes` | Use five fields and at least 15 minutes between runs. |
| `pricing: yearly cannot cost more than twelve months` | Lower `yearly` to at most 12 × `monthly`. |
| `slug: must match pattern …` | Lowercase letters, digits and single hyphens: `my-agent`. |
| `version: must match pattern …` | Use three numbers: `1.0.0`. |
| `manifest: must NOT have additional properties` | Remove fields the schema doesn't know (check spelling). |
| `Cannot read timeflic-agent.json` | Run it in the folder with the file, or pass the path. |

## Rules every agent runs under

TimeFlic enforces these in code, whatever the manifest or instructions say:

- **No outside network.** An agent reaches only TimeFlic, plus the `connections` it declares, which TimeFlic connects for it.
- **One workspace.** An agent acts only in the workspace it is installed in.
- **No power over access or money settings.** It can never grant permissions, create tokens, install add-ons, change billing, or change its own role or autonomy.
- **Workspace text is data.** Comments and descriptions it reads cannot change what it is allowed to do.
- **Limits and budgets.** Each run stops at its step and tool-call limits. Each install has a monthly budget the owner controls; the owner can pause the agent at any time.
- **Everything is recorded.** Every action is recorded as done by the agent, and the owner can open each run and see its steps.

## Use it in CI

`validate` exits non-zero on any problem, so it can guard every change to your manifest. In GitHub Actions:

```yaml
name: agent
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx --yes @timeflic/cli@0.1 agent validate timeflic-agent.json
```

Pin a version (`@0.1`) so the rules only change when you choose to upgrade.

## Troubleshooting

| What you see | Why, and what to do |
|---|---|
| An older version runs | `npx` caches packages. Run `npx @timeflic/cli@latest …`, or `npm install -g @timeflic/cli@latest`. |
| `SyntaxError` or a crash on start | Node.js is older than 20. Check `node --version` and upgrade. |
| `timeflic: command not found` | You used `npx` without installing. Use `npx @timeflic/cli …`, or install with `npm install -g @timeflic/cli`. |
| `… already exists; pass --out …` | `init` never overwrites. Pass `--out other-name.json`. |
| A command says the Developer Portal is not open yet | `login`, `test`, `submit` and the other Portal commands arrive when it opens. |

Found a bug or have a question? [Open an issue](https://github.com/timeflic-official/timeflic-cli/issues) and include the output of `timeflic --version`: it shows the CLI version and the date of the rules it checks against. Security problems go through [private reporting](https://github.com/timeflic-official/timeflic-cli/security) instead; see `SECURITY.md`.

## Versions

- Each CLI version carries a fixed copy of TimeFlic's manifest schema, tools and events, so the same version always gives the same answer. `timeflic --version` shows when they were taken from TimeFlic.
- `0.x` versions cover building and validating; `1.0` arrives with the Developer Portal commands.
- Changes are listed in `CHANGELOG.md` in the package.
- The source is at [github.com/timeflic-official/timeflic-cli](https://github.com/timeflic-official/timeflic-cli). Releases are built there by GitHub Actions and published with npm provenance, so npm shows which commit and workflow built each version.
- The package has no dependencies; the open-source code bundled in it is listed with its licences in `dist/THIRD_PARTY_LICENSES.md`.

## Licence

MIT
