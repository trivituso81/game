# Workflow

## Roles

| Who | Does |
|---|---|
| Tom | Designs and directs. Answers intake rounds. Makes pictures, voices and music on the admin pages. Plays each build on his iPhone and reports what he sees |
| Claude | All technical work. Makes implementation calls and says which one. Asks only when a choice cannot be undone or is expensive to redo |

## Build cycle

1. The ordered list of builds is the build plan kept in Tom's project (`claude/build-plan.md`). One build per session.
2. A content build is proposed to Tom in a short table first and built after he says yes. An engine build with no design choice is Claude's call.
3. Design input comes from the intake rounds, one round at a time, only the round the next build needs.
4. Build, run the three test commands, look at the frames in portrait and landscape, then push.
5. Every push: move the build tag if `index.html` or an engine file changed, add a `docs/CHANGES.md` entry, purge replaced files.
6. Mark the build DONE with its commit in the build plan.

## Session handoff

- A session starts by reading `claude/next.md` in Tom's project and only the files it lists.
- A session ends by rewriting `claude/next.md`: live state, the one next task, exact files to read, test commands. Re-read it right before writing and merge, because other sessions edit it.
- The last message to Tom says in two lines what the next session will do and gives the prompt to paste.

## Reporting to Tom

- First line: what was done, in past tense. Then exactly what he does next, step by step.
- A few plain sentences. Tables over prose. Define technical terms. Say whether a statement is a fact, a recommendation or a question.
- No long dashes.
- Never ask him to run a command or pick an implementation option.

## Stop-loss

If the same fix or the same render fails twice in a row, stop. Do not send a third variant. Tell Tom why repeating will not work, what is actually going wrong, and the specific change needed: a fresh conversation, a different method, or something only he can supply. Write the handoff into `claude/next.md`.

## Canon

Decisions about title, story, cast, world and rules go in `docs/CANON.md`, one dated line each, and in the project's canon file. Nothing is invented to fill a gap.
