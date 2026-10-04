# Project: <name>

<!-- Loaded into every Claude session: keep it short. Delete sections you don't need.
     Add a rule here whenever Claude makes a mistake because it didn't know a convention. -->

## Commands
- Install: `<command>`
- Test all: `<command>` · one file: `<command> path/to/test`
- Lint + types: `<command>` (run before saying "done")

## Architecture
- <boundary, e.g. "UI never talks to the DB directly">

## Conventions
- <convention that is not visible from the code>

## Gotchas
- <trap, e.g. "legacy/ is frozen — do not modify">

## More docs
- Architecture decisions: `docs/adr/` (one file per decision, start from `0000-template.md`)
