# Subagents and model routing

Research and implementation notes, 2026-10-21. Implemented against the project's
pinned Pi 1.3.0; no dependency upgrade or Pi fork is needed.

## What the upstream research established

Pi's [official subagent example](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent)
implements delegation as an extension spawning separate Pi processes. It supports
specialist prompts, tool/model selection and structured results. The process owns
its conversation context; the parent receives the findings. Our implementation
uses that approach but narrows children to research tools and adds bounded runtime.

Pi's [virtual-model API](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/virtual-models.md)
registers a selectable model whose route function chooses a physical model per
request. The selected virtual model and dispatched physical model are tracked
separately. Router state follows session branches. The documentation recommends
keeping follow-up requests and retries on their prior model to avoid unnecessary
cache disruption. We use a deterministic task classifier instead of an additional
paid classifier call. This is a heuristic, not a measured optimal routing policy.

Pi's [CLI integration documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md)
explains the JSON event protocol and notes that a model error may still produce a
zero process exit code. Therefore our runner checks the final assistant stop reason,
answer text, process status and diagnostics together.

The matching documents and example are included in the installed npm package;
we checked those as well as the current upstream documents. The linked `main`
branch may change after this implementation.

## Two separate mechanisms

- **Delegation** creates another conversation for a bounded task. The parent
  synthesizes the answer after the child returns.
- **Routing** chooses the physical model for a conversation's request. It does
  not create another agent. Parent routing and child role routing can be combined.

The parent exposes `delegate_task`:

```json
{
  "role": "researcher",
  "task": "Find primary sources about test-time adaptation. Return links and uncertainties.",
  "timeoutSeconds": 120
}
```

| Role | Work | Model tier | Child tools |
|---|---|---|---|
| researcher | Source discovery | fast | research_search |
| analyst | Synthesis and experiment planning | deep | research_search |
| reviewer | Challenge claims and check evidence | deep | research_search |

Example conversation requests:

> Delegate source discovery to a researcher and an independent critique to a
> reviewer. Compare their findings and save a sourced brief.

> Ask an analyst to propose a falsifiable experiment from these findings. Run the
> approved experiment with the parent experiment tool, then ask a reviewer to
> assess the recorded result.

A child receives only the task text supplied by the parent, its role instructions,
and the research instructions. It receives no automatic parent transcript or
personal memory. The parent must include relevant context explicitly. Children
cannot delegate recursively, access the built-in file tools, mutate memory, save
reports, or execute experiments. They inherit provider authentication and search
credentials; separate processes are **not an OS security sandbox**.

The parent may issue parallel `delegate_task` calls. A parent-wide limiter allows
three running children, rejecting excess calls with a retryable explanation.
For sequential work, call the tool again with the relevant previous findings.
There is no autonomous scheduler, recursive swarm or separate batch/chain syntax.

## Configure model routing

Create `~/.research-companion/routing.json`, or set `RESEARCH_ROUTING_CONFIG` to
an absolute file path. If you changed `RESEARCH_COMPANION_HOME`, the default config
path is inside that directory instead. The [example](../examples/routing.json)
contains placeholders; replace them with exact IDs available in Pi's `/model`.
Do not put credentials in this file.

```json
{
  "default": "YOUR_PROVIDER/YOUR_DEFAULT_MODEL_ID",
  "fast": "YOUR_PROVIDER/YOUR_FAST_MODEL_ID",
  "deep": "YOUR_PROVIDER/YOUR_REASONING_MODEL_ID",
  "code": "YOUR_PROVIDER/YOUR_CODING_MODEL_ID"
}
```

Different tiers may use the same model or different authenticated providers.
Only `default` is needed for a working automatic router. Configure provider access
with Pi `/login`, provider environment variables, or Pi's private `models.json` for
custom endpoints. The project does not select paid providers for you.

Start the routed parent:

```sh
npm start -- --model companion/auto
```

Alternatively select `companion/auto` with `/model` in an existing session.
The default launcher still respects Pi's ordinary model selection; routing is opt-in.
Configuration is read for each new routing/delegation decision, so edits do not
require restarting. Follow-ups and retries intentionally stay on their prior model.

Classification precedence:

1. A leading `[route:fast]`, `[route:deep]` or `[route:code]` explicitly chooses a tier.
2. Implementation/debugging/experiment keywords choose `code`.
3. Research/comparison/review keywords or text longer than 1,500 characters choose `deep`.
4. Other prompts choose `fast`.

Only the latest user message is classified, not tool output or retrieved pages.
Rules currently use English keywords; use the explicit prefix for other languages
or ambiguous requests. Direct requests without a previous model use `fast`.
The selected virtual thinking level is passed through; Pi clamps it to the model's
capabilities. Follow-up tool results and retries use the prior physical model and
thinking level. No automatic provider failover occurs.

Children choose their role tier, then `default`, then the parent's selected
physical model. With a virtual parent and no usable tier/default, delegation
reports a configuration error. Unknown models, virtual routing targets and missing
configured authentication fail explicitly. Provider access can still fail at
request time; no unrelated model is silently substituted.

## Bounds and observability

- Default deadline: 120 seconds; configurable from 1–300 seconds per task.
- Maximum 12 assistant responses if a child is still requesting tools.
- Maximum 8 MiB of child JSON events; 8,000 characters of stderr retained.
- Cancellation/timeout sends SIGTERM, then SIGKILL after one second if needed.
- Complete captured answer, task, selected model, usage, timestamps and status are
  saved under the private `delegations/` directory, including failed runs.
- Parent model-visible answers are capped at 24,000 characters, with a truncation
  marker; full captured results remain in tool details and the saved record.
- Progress includes role/model, response count and tool name. Child usage is
  returned to Pi, and can also be inspected through `research_history` with
  `kind: "delegations"`.

These bounds are not a dollar budget. Several concurrent children can increase
cost. Provider token/cost reporting is best effort; this implementation does not
claim savings without measurement. Changing providers may send task context to a
different service. Research records remain private by default.

## Validation and limitations

`npm run check` and `npm test` cover routing precedence, sticky follow-ups/retries,
model/auth validation, restricted child tools, JSON framing including split Unicode,
error and incomplete-response detection, cancellation, timeout and concurrency.

The integration test launches **real Pi processes** against a local deterministic
mock endpoint. It verifies a child search-only toolset and the complete parent →
analyst → parent sequence, with routed requests going to `code-model`, `deep-model`,
then `code-model`. It exercises actual extension registration and CLI streaming
without using personal credentials or paid inference. It does not establish model
quality, live-provider access, cost savings or research accuracy.

Full web-page/PDF retrieval and evidence-quality evaluations remain future work.
The existing search tools return metadata/snippets, so neither parent nor child
should claim to have read full sources based only on search results.
