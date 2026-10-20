# Research Companion

A personal research and experimentation assistant built on [Pi](https://pi.dev/).
Research a technology, connect it to your preferences, run a bounded experiment,
and keep the evidence for the next conversation.

## Quick start

Requires Node.js 22.19+ and npm. Docker is optional for experiments.

```sh
npm ci
npm start
```

Inside Pi, use `/login` to configure a supported provider, or export a provider API
key such as `ANTHROPIC_API_KEY` before starting. Model usage may incur provider charges.
Choose a model with `/model`. No model credentials are bundled.

Example requests:

- “Remember that I prefer small reproducible prototypes before adopting a framework.”
- “Find recent papers about test-time adaptation. Explain the evidence and uncertainties, then save a brief.”
- “Research this technology for my current project. Separate what the sources claim from what we can test.”
- “Show my memories and forget the preference I no longer agree with.”

For general web search, export `BRAVE_API_KEY` from your Brave Search API account.
Paper metadata search uses Crossref without credentials. Search results are leads:
this first version does not include full-page browsing or PDF extraction, so it must
not claim to have read full sources. You can provide local source documents as text.

## Experiments

Pull a suitable image yourself, then ask the assistant to run a small experiment:

```sh
docker pull python:3.12-alpine
```

“Run an experiment in python:3.12-alpine comparing list membership with set
membership over 10,000 integers. Print timings and save the command and result.”

Containers run offline with no host mounts, a read-only root filesystem, an
unprivileged user, 512 MB RAM, one CPU, a PID limit and a 1–300 second timeout.
Use an image digest for reproducible dependencies. Images need `sh`; dependencies
must already be in the image. Docker must be running. This is a bounded local
experiment runner, not GPU provisioning or a hostile-code security boundary.

## Personal data

Memory, reports and experiment records live in `~/.research-companion/`, outside
this repository. Override with `RESEARCH_COMPANION_HOME`. Records are readable JSON.
Ask the agent to list/forget memories or edit the records directly while it is idle.
Confirmed preferences and tentative observations are stored separately by status.
Pi manages its own credentials and session history in its user configuration.
Selected memory and source content may be sent to your chosen model provider.
Do not commit personal data or credentials. No personal data is included here.

The launcher starts Pi in the private data directory with only its built-in `read`
tool plus this project's tools. Passing Pi flags can change that tool selection.
This limits ordinary operations, but is not filesystem isolation: read and other
explicitly enabled extensions still run with your user's permissions. Automatic
extension, MCP, skill, prompt and context-file discovery is disabled by the launcher.

## Development

```sh
npm test
npm run check
```

`src/extension.ts` defines Pi tools and research instructions; `src/store.js` owns
local records; `src/experiment.js` owns the Docker runner. Tests use temporary data
and do not call a model. CI checks types and tests on Node 22.

## Scope

This first version includes persistent memory, paper/web search, source-linked
briefs, history, and bounded experiments. It does not include unattended schedules,
WeChat, autonomous messaging, GPU jobs, or a web UI. Next: full-source retrieval,
claim-to-source validation, experiment workspaces and research evaluations.

MIT licensed. Built independently on Pi; not an official Pi product.
