@AGENTS.md
@TESTING.md

# Claude Code bridge

`AGENTS.md` (how to work) and `TESTING.md` (how to verify) are the shared
contract for every harness. This file only imports them so Claude Code loads
the same rules; do not duplicate them here.

- Agent scratch, inbox/outbox and handoffs go in the ignored repo-root `.ai/`.
  Durable operational receipts stay in the unsynced AI-Wiki runtime root.
- Never put credentials, tokens or personal profile data in shared files.
