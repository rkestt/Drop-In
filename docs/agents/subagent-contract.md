# Subagent contract

How the main session and its sub-sessions split the work. The main session reads the roadmaps, picks a lane, dispatches, and reconciles. A sub-session owns one ticket from dispatch to evidence and then stops.

The routing table — which specialist does what — is in `AGENTS.md`. This file covers only what crosses between the two sessions: what a sub-session is given, what it may touch, what it hands back, and what the main session does with that.

## Context comes from the repo

A sub-session is given an **issue number**. Everything else it reads:

| What | Where |
|---|---|
| What to do, and when it is done | the GitHub issue — commands in `issue-tracker.md` |
| Why it is in the plan, and what breaks if it is skipped | the lane in `docs/plans/spring.md`, planned from `docs/roadmaps/<lane>.md` |
| What the domain concepts are called | `GLOSSARY.md` at the root |
| How this repo's agents work | `AGENTS.md`, `domain.md`, `issue-tracker.md`, `triage-labels.md` |

The dispatch message is the issue number, the lane, and nothing else. A plan, a file summary, or a restatement of the ticket body is a copy: it goes stale silently and diverges from the repo, while the three sources above stay versioned.

A ticket is dispatchable when it carries `ready-for-agent` and has zero open blockers (`issue-tracker.md`, **Count open blockers**). A ticket too large for one context becomes sub-issues, each dispatched on its own — not phases of one ticket.

## The contract

- **Input** — one open issue number. When the ticket does not carry what the work needs, the sub-session reads the plan, the roadmap, the ADRs and the code. Then it says whether the ticket itself is incomplete; it does not guess the missing decision.
- **Boundary** — the diff touches only what the ticket asks. Work discovered on the way goes into the issue comment, never into the diff, and the sub-session opens no tickets.
- **Output** — commits on its branch, and one comment on the issue with the evidence: the command that was run, its output, the screenshot, the migration name. Evidence is something a stranger can repeat.
- **Stop** — no push, no `gh issue close`, no merge, no release. The main session decides those.

## Isolation

Work lands on `master`, one ticket at a time. Two tickets that write at once get separate worktrees (skill `worktrees`) and merge in order; the second rebases after the first lands.

## Reconciling

A sub-session's report is a claim, not a completion. For each returning ticket the main session:

1. reads `git status` and `git diff` — what actually changed, including files the report did not mention;
2. re-runs the ticket's own evidence command, plus `npm run test:all` when the ticket touches code;
3. reads the issue comment against the ticket's acceptance criteria;
4. only then pushes, closes, merges, or sends the ticket back with the findings as the new objective.

Where the report and the diff disagree, the diff wins. Where the ticket and the code disagree, the code wins and the ticket gets corrected before the ticket restarts.

Stopping the loop: a ticket rejected twice goes to `@oracle` for the decision, or to the user when the choice is about product, not code.

## When a sub-session is itself the main session

A ticket that stays inside one area gets flat lanes, dispatched by whoever holds the main session. A ticket that crosses areas — schema plus client plus UI, as #96 did — gets a sub-session that orchestrates its own lanes, so reconciliation does not eat the context of the session that called the roadmaps.

Either way the dispatch is the same three lines: the issue number, the lane, and `docs/agents/subagent-contract.md`. Whether the child orchestrates is the main session's call, made per ticket, and it is the only thing that changes.

The child that orchestrates also owns three rules:

- **Check that it can dispatch before accepting the ticket.** As of 2026-11-18 the answer here is no: a child session gets the task tools (`task_status`, `task_result`, `task_revive`) but not `subagent`, and `openchamber.session.create` makes a session the user talks to, not a child. So orchestration stays with the main session, and a sub-session is an executor: give it one bounded piece and the decision it implements.
- **Fold review findings into the tester's checklist before the live round.** A tester verifies the list it was given; a green report and an open defect can arrive in the same hour (#96: the designer's six cases all passed while the reviewer found the drawer never reset on reopen).
- **Write what must survive into the issue or the diff.** The child sees none of its parent's background tasks and nothing of its parent's conversation.

## Asking the user

A decision reaches the user with what it changes in real use: what a player or an organiser sees, how many people are affected, and what happens at the two extremes. The ticket number is a pointer for whoever wants the detail, never the explanation. The user decides without opening GitHub.
