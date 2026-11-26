# Agent harness conventions

- `.ai/` at the repository root is ignored scratch: `inbox/` for intake,
  `outbox/` for deliverables, `evidence/` for checks, `archive/` for preserved
  originals. Do not commit it.
- Durable deployment receipts belong in the unsynced AI-Wiki runtime root
  (`B:\AI-Wiki.runtime\artifact-lifecycle\...`), not in this public repository.
- `AGENTS.md` is the entry point for all harnesses; `CLAUDE.md` only imports it
  and `TESTING.md`. Keep detailed rules in `docs/` and link them from the entry
  point rather than copying them.
- Native harness configuration, credentials, sessions and profiles stay
  tool-managed. Never read or print secret stores.
- Preserve unrelated work and recovery copies; a hash mismatch blocks
  restoration over later changes.
