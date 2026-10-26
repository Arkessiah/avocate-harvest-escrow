# How we build

Avocate Harvest Escrow was built during HackMeridian on top of a development environment that the author
has been refining for more than a year. The ideas, the product decisions and the design are the author's;
AI coding agents are used as execution tools inside a system of rules, memory and checks. This page
describes that system. It does not include prompts.

## Tools at a glance
| Tool | What it is used for |
|---|---|
| **Claude Code** | AI coding agent that executes the work, under the rules below |
| **Obsidian** | The knowledge vault: long-term memory across projects |
| **Raven MCP + Stellar skills** | Current Stellar documentation, ecosystem data and build playbooks |
| **Playwright** | Screenshots and end-to-end checks in a real browser |
| **CoinFabrik Scout** | Static analysis of the Soroban contracts |
| **GitHub Actions, pnpm** | CI on every push; a package manager with stricter dependency handling |
| **Vercel** | Hosts the web app and deploys it from `main` on every push; holds the service and demo keys as environment variables |

## A knowledge vault as long-term memory
- A personal knowledge vault in Obsidian holds what each project teaches: reusable know-how by topic,
  architecture decisions per project, and workarounds that took hours to find.
- Every project keeps its own context next to it: current phase, decisions, constraints and an operations
  runbook. That context stays private and out of the repository.
- An authorship log records, for important work, what the author contributed and what was executed by
  tools.

## Rules for the agents
A written rulebook applies to every project and every session. Some of what it enforces:
- **Git discipline**: pull before editing, small commits in a fixed format, push after each one, and no
  commit without the author's approval.
- **Public repositories**: no keys, internal hostnames or private context in code or history; a secret
  scan before every push.
- **Decisions stay with the author**: product choices, dependencies, versions and scope are proposed with
  their trade-offs, never taken by an agent.
- **Honesty**: every number is re-derived before it is repeated, estimates are labelled as such, and
  failures are reported as they are.
- **Quality bar**: code that a senior engineer would accept, interfaces checked at phone and desktop
  widths, and no generic "made by AI" look in design, copy or code.
- **Security before production**: an exposure checklist for every deployment and hardened public forms.

## Agents and skills used in this project
Claude Code is the main agent. For work that benefits from a separate, focused pass it delegates to
specialised agents:

| Agent | What it did here |
|---|---|
| **Smart-contract auditor** | Manual security review of the three contracts, alongside Scout; its findings are in the [security review](audits/) |
| **Research agents** | Studies of the HackMeridian partner integrations and of the fiat on/off-ramp options in test mode |
| **Writing agents** | The problem and solution summary, and keeping the pitch script in line with what was built |
| **Parallel build agents** | The animated isometric figure on the landing page, built and reworked around agriculture |

Skills used:
- **Stellar**: the Raven MCP server for up-to-date documentation and ecosystem data, and the Stellar skills
  for contracts, wallets, assets and agentic payments (x402).
- **Design**: Hallmark, a design-system skill against generic layouts, and Anatomy, for the isometric
  figure.

## Checks in this project
- Contract tests with soroban-sdk and web tests with Node's test runner, in GitHub Actions.
- CoinFabrik Scout plus a manual review, published in [`audits/`](audits/).
- Browser checks with Playwright: screenshots at 320, 375 and 1280 px, and flows driven end to end,
  including a QR scanner fed by a simulated camera.
- `scripts/seed.mjs` and the smoke scripts run the real flows against testnet.
