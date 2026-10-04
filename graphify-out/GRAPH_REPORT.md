# Graph Report - using-claude-code  (2026-10-04)

## Corpus Check
- 38 files · ~27,134 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 168 nodes · 257 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `44d949be`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_apply.mjs|apply.mjs]]
- [[_COMMUNITY_File Structure|File Structure]]
- [[_COMMUNITY_apply.test.mjs|apply.test.mjs]]
- [[_COMMUNITY_setup-kit — автоналаштування Claude Code для команди|setup-kit — автоналаштування Claude Code для команди]]
- [[_COMMUNITY_components.mjs|components.mjs]]
- [[_COMMUNITY_fsops.mjs|fsops.mjs]]
- [[_COMMUNITY_merge.mjs|merge.mjs]]
- [[_COMMUNITY_script.js|script.js]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_setup-kit — автоналаштування Claude Code  автонастройка Claude Code|setup-kit — автоналаштування Claude Code / автонастройка Claude Code]]
- [[_COMMUNITY_Project name|Project: <name>]]
- [[_COMMUNITY_Claude Code для команди|Claude Code для команди]]
- [[_COMMUNITY_ADR-NNNN title|ADR-NNNN: <title>]]
- [[_COMMUNITY_node_ok|node_ok]]

## God Nodes (most connected - your core abstractions)
1. `main()` - 13 edges
2. `File Structure` - 12 edges
3. `entry()` - 9 edges
4. `applyJson()` - 8 edges
5. `executeAction()` - 8 edges
6. `parseJson()` - 8 edges
7. `tmpDir()` - 8 edges
8. `setup-kit — автоналаштування Claude Code для команди` - 8 edges
9. `commit()` - 7 edges
10. `setup-kit — автоналаштування Claude Code / автонастройка Claude Code` - 7 edges

## Surprising Connections (you probably didn't know these)
- `mergeHookEntries()` --indirect_call--> `entry()`  [INFERRED]
  setup-kit/lib/merge.mjs → setup-kit/lib/fsops.mjs
- `ctxOf()` --indirect_call--> `fixedNow()`  [INFERRED]
  setup-kit/test/fsops.test.mjs → setup-kit/test/helpers.mjs
- `main()` --calls--> `runDoctor()`  [EXTRACTED]
  setup-kit/lib/apply.mjs → setup-kit/lib/doctor.mjs
- `main()` --calls--> `executeActions()`  [EXTRACTED]
  setup-kit/lib/apply.mjs → setup-kit/lib/fsops.mjs
- `setup()` --calls--> `main()`  [EXTRACTED]
  setup-kit/test/apply.test.mjs → setup-kit/lib/apply.mjs

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "apply.mjs"
Cohesion: 0.15
Nodes (18): chooseInteractively(), commitList(), createAsk(), main(), report(), show(), SYMBOL, TEMPLATES (+10 more)

### Community 1 - "File Structure"
Cohesion: 0.12
Nodes (15): Action contract (shared by Tasks 4–8), File Structure, Global Constraints, Review Focus, setup-kit Implementation Plan, Task 10: Guide section 13 (UK + RU), Task 1: Scaffold + pure merge helpers, Task 2: Preset resolver (+7 more)

### Community 2 - "apply.test.mjs"
Cohesion: 0.22
Nodes (11): parseCli(), COMPONENTS, setup(), byId(), ctxOf(), templatesDir, setup(), ctxOf() (+3 more)

### Community 3 - "setup-kit — автоналаштування Claude Code для команди"
Cohesion: 0.13
Nodes (14): 1. Мета, 2. Архітектура, 3. Компоненти, 4. CLI, 5. Злиття і безпека, 6. Тестування, 7. Зміни на сайті, doctor (+6 more)

### Community 4 - "components.mjs"
Cohesion: 0.17
Nodes (11): BOTH, copy(), FULL, inProject(), installer(), INSTALLERS, json(), requireUv() (+3 more)

### Community 5 - "fsops.mjs"
Cohesion: 0.38
Nodes (13): applyExec(), applyFile(), applyJson(), applyLines(), applyRequire(), commit(), diffLines(), entry() (+5 more)

### Community 6 - "merge.mjs"
Cohesion: 0.30
Nodes (9): readJson(), runDoctor(), appendLines(), isObj(), mergeHookEntries(), mergeJson(), mergeValue(), parseJson() (+1 more)

### Community 7 - "script.js"
Cohesion: 0.22
Nodes (8): boxes, i18n, links, observer, savedTheme, search, sections, state

### Community 8 - "package.json"
Cohesion: 0.25
Nodes (7): engines, node, name, private, scripts, test, type

### Community 9 - "setup-kit — автоналаштування Claude Code / автонастройка Claude Code"
Cohesion: 0.25
Nodes (7): RU — кратко, setup-kit — автоналаштування Claude Code / автонастройка Claude Code, Запуск, Компоненти, Перевірка на Windows / RDP (для команди), Прапорці, Розробка

### Community 10 - "Project: <name>"
Cohesion: 0.29
Nodes (6): Architecture, Commands, Conventions, Gotchas, More docs, Project: <name>

### Community 11 - "Claude Code для команди"
Cohesion: 0.33
Nodes (5): Claude Code для команди, Запуск локально, Мови, Публікація, Як оновлювати

### Community 12 - "ADR-NNNN: <title>"
Cohesion: 0.40
Nodes (4): ADR-NNNN: <title>, Consequences, Context, Decision

## Knowledge Gaps
- **64 isolated node(s):** `savedTheme`, `i18n`, `links`, `observer`, `search` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `parseJson()` connect `merge.mjs` to `components.mjs`, `fsops.mjs`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `main()` connect `apply.mjs` to `apply.test.mjs`, `fsops.mjs`, `merge.mjs`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `tmpDir()` connect `apply.test.mjs` to `fsops.mjs`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `savedTheme`, `i18n`, `links` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `File Structure` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `setup-kit — автоналаштування Claude Code для команди` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._