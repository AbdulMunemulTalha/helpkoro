# Claude Code Workflow

For each task, read BUILD.md, CLAUDE.md, this blueprint, and the relevant domain specification. State affected modules, implement the smallest complete vertical slice, update migrations/contracts/tests/docs, and run relevant checks.

One branch or PR contains one coherent capability, such as campaign drafts, ledger postings, or case assignment. Required evidence: requirement links, migration/API impact, authorization implications, test output, UI screenshots, telemetry changes, rollout/rollback notes, and new validation blockers.

Never shortcut by mocking production balances, bypassing reviewer or finance control, mutating ledger history, storing secrets in source, exposing evidence URLs, or asserting Bangladesh compliance without approved documentation.
