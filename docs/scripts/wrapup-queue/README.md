# Wrap-up queue

Runs the wrap-up automatically after every finished Claude Code session, also after `/clear`. It
is off until you install it, because every wrapped session is one headless Claude run on your plan.

```bash
node docs/scripts/wrapup-queue/worker.mjs install            # sessions in this vault
node docs/scripts/wrapup-queue/worker.mjs install --global   # also sessions in other folders
node docs/scripts/wrapup-queue/worker.mjs status
node docs/scripts/wrapup-queue/worker.mjs uninstall
```

Needs Node.js 18 or newer (tested with 22 and 24) and the `claude` CLI. `install` records the absolute paths of both,
because the OS scheduler starts the worker with a minimal `PATH`.

## How it works

1. **Queue.** A `SessionEnd` hook runs `enqueue.mjs`. It writes one job file and exits in well
   under a second. Claude Code ends `SessionEnd` hooks before slow work finishes, so the hook never
   runs `claude` itself.
2. **Worker.** The OS scheduler starts `worker.mjs tick` when a job arrives and every 5 minutes.
   The worker takes the oldest session and checks the gates. It condenses the transcript part
   since the last wrap-up (prompts in full, tool output left out) and runs
   `claude -p --model sonnet` with `job.md` as the task.
3. **Write boundary.** `guard.mjs` is a PreToolUse hook of the job run only, and the job's only
   source of permissions. It allows writes to `projects/`, `research/`, `decisions/`,
   `knowledge/`, `docs/wrapup-inbox/` and `log.md`, and only read-only Bash
   commands; it answers every other call with deny. The job runs with `--permission-mode
   default`, so it needs no allow rules in your settings, and without the guard it cannot write.
   An `--allowed-tools` list would not do this: it does not restrict a session that runs with
   `bypassPermissions` or broad allow rules.
4. **Commit.** The worker commits only files that changed during the run and that the job itself
   wrote. Edits of parallel sessions stay out. A file that already had uncommitted changes before
   the run stays uncommitted, with the job's edit in it, so your own work never ends up in a
   wrap-up commit. If the guard saw no tool call at all (for example because your settings
   disable hooks), nothing is committed and the job counts as failed. The worker commits locally
   and never pushes. `--no-commit` at install turns this off.
5. **Inbox.** Tasks, issues, fixes outside the vault, open decisions and memories go into
   `docs/wrapup-inbox/YYYY-MM-DD-<session>.md`. The job never creates tasks or issues, and it
   cannot write memories: Claude Code refuses writes under `.claude/` in default permission mode,
   whatever a hook says. The
   session start shows one line while open inbox files exist; `/wrapup-inbox` works through them
   with your answer.

The job files durable notes (decisions, project status, research) without asking, because nobody
is there to answer. Each inbox file and `log.md` list what it filed. Revert a commit with
`git revert <sha>` if you disagree.

## Triggers per OS

| OS | Scheduler | Starts on a new job | Retry interval |
|---|---|---|---|
| macOS | launchd agent `dev.brain-starter.wrapup-queue.<id>` in `~/Library/LaunchAgents/`, under `taskpolicy -b` | yes (`WatchPaths`) | 5 min |
| Linux | systemd user units `brain-starter-wrapup-<id>.{service,path,timer}` in `~/.config/systemd/user/` | yes (path unit) | 5 min |
| Windows | Task Scheduler task `brain-starter wrapup <id>`, through a hidden `wscript` launcher | no | 5 min |

`<id>` comes from the vault path, so two vaults get two schedulers. `install --print` shows the
files and commands without changing anything. On Linux, user units run only while you are logged
in, unless you enable lingering (`loginctl enable-linger`).

**Windows is untested.** The Task Scheduler setup follows the documented `schtasks` options, but
nobody ran it on Windows yet. Please report what happens. Tasks that `schtasks` creates do not
start on battery power by default; change that in Task Scheduler if your laptop is often
unplugged.

**Several Claude config directories** (`CLAUDE_CONFIG_DIR`): `--global` writes the hook into the
settings of the current one. Run `install --global` once in each; `uninstall` removes the hook
from all of them.

## Gates

- Never at critical memory pressure. Pressure comes from `kern.memorystatus_vm_pressure_level` on
  macOS, from `/proc/pressure/memory` on Linux (`some avg10` under 5 is normal, 30 or more is
  critical), and from free memory elsewhere (more than 20 % free is normal).
- Start at normal pressure, or after 3 hours of waiting at any pressure below critical.
- If a run fails with a usage limit message, the queue waits one hour before the next try. That
  does not use up the retry.
- Jobs older than 24 hours are skipped (`skip-backlog`), for example after a week offline. They
  land in `failed/`, so the session start notice shows them; `requeue` runs them anyway.
- At most 3 sessions per tick, one at a time (lock directory `worker.lock.d`).
- Segments with fewer than 1,500 characters or no prompt are `trivial`: no Claude run.

## Queue files

Everything lives in `.claude/wrapup-queue/` in the vault (gitignored):

| Path | Content |
|---|---|
| `config.json` | Written by `install`. Without it the hook does nothing. |
| `pending/`, `running/`, `done/`, `failed/` | Job files, with a `.result.json` next to each finished one |
| `wrapped/<session id>` | The last message uuid that was wrapped. A resumed session continues from there and is not wrapped twice. |
| `logs/YYYY-MM-DD.log` | Worker log with the agent's report per run |
| `limited.json` | Set when a run hit a usage limit |

A manual `/wrap-up` inside a session moves the start of the next automatic segment behind it.

A failed run that left nothing in the vault goes back to `pending/` once, 15 minutes later. A run
that wrote files is never retried, because it would file the same things twice. A job that a dead
worker left in `running/` (reboot, power loss) moves to `failed/` as `interrupted` at the next
tick. Check what it filed, then requeue a failed, skipped or interrupted session by hand with
`worker.mjs requeue <session id prefix>`.

The session start shows one line while `failed/` holds job files.

## Recursion guard

The vault hook and the optional global hook can both fire for one session; the worker merges all
job files of a session into one run.

The job run sets `BRAIN_WRAPUP_JOB=1`, and the hook skips it. The hook also skips every run whose
`CLAUDE_CODE_ENTRYPOINT` is not `cli`, which covers `claude -p` and SDK agents. The job prompt
starts with `[brain-wrapup-job]`; `recent-sessions.mjs` and the worker ignore sessions that carry
it.

## Dry run

Test the job against a copy of the vault. Nothing is committed and no watermark is set:

```bash
cp -R ~/my-brain /tmp/brain-copy          # on macOS, cp -cR makes a fast APFS clone
node docs/scripts/wrapup-queue/worker.mjs dry-run <session id prefix> --vault /tmp/brain-copy
```

The result shows the exit code, the files the job wrote, and whether the `log.md` entry exists.

## Tests

```bash
node --test docs/scripts/wrapup-queue/tests/
```
