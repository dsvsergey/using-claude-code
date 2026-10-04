<!-- setup-kit:start -->
## Team defaults (setup-kit)
- One session = one task; suggest `/clear` between unrelated tasks.
- For non-trivial changes: explore first and propose a plan before editing code.
- Verify before saying "done": run the project's tests, lint and type checks; for UI, check it visually.
- Prefer precise file paths; for broad codebase questions use a subagent and return only the conclusion.
- If `graphify-out/graph.json` exists, run `graphify query "<question>"` before grepping; after code changes run `graphify update .`.
- For library and framework APIs, check current docs via Context7 instead of relying on memory.
- Never read or print secrets (`.env`, `secrets/`) and never commit them.
- Never `git push` or rewrite git history without explicit confirmation.
<!-- setup-kit:end -->
