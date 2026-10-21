# Changelog

## 0.2.0 — 2026-10-21

- Added `delegate_task` with researcher, analyst and reviewer roles in separate
  Pi conversations, restricted search tools, and no recursive delegation.
- Added three-child concurrency control, deadlines, response/output limits,
  cancellation, progress, usage accounting and saved delegation results.
- Added the opt-in `companion/auto` virtual model with configurable fast/deep/code
  tiers, explicit prompt overrides, and sticky follow-ups/retries.
- Added routing and subprocess tests, including real Pi parent/child integration
  using a local mock inference endpoint.
- Documented research sources, design choices, configuration and limitations.

## 0.1.0

- Initial Pi assistant with local memory, paper/web search, saved research briefs
  and bounded offline Docker experiments.
