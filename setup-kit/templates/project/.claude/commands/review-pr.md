---
description: Review a pull request by number
argument-hint: <PR number>
allowed-tools: Bash(gh pr view:*), Bash(gh pr diff:*), Read, Grep, Glob
---
Review PR #$ARGUMENTS.

1. Run `gh pr view $ARGUMENTS` and `gh pr diff $ARGUMENTS`.
2. Check the changes against the conventions in CLAUDE.md.
3. Report only real issues: file:line, why it matters, a concrete fix. No style nitpicks.
