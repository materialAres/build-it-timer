---
name: create-pr
description: Create a GitHub pull request from the terminal with gh, after checking that both branches exist (locally and on origin), are in sync, have no uncommitted work and no merge conflicts, and that no duplicate PR is open. Generates an English conventional title and a description from the commit range. Usage - /create-pr [source|-] <destination> [title|-] [description|-] [--merge]
---

# create-pr skill

Creates a pull request with `gh`. It never pushes, never rewrites history, and never merges unless `--merge` is passed. Everything it writes (title, description, messages) is in English.

## Arguments

`/create-pr [<source>] <destination> [<title>] [<description>] [--merge]`

- Positional arguments are read in order. Use `-` for an omitted middle argument (e.g. `/create-pr - main - - --merge`).
- If only one positional argument is given, it is the **destination** and the source is the current branch.
- `<source>` omitted (or `-`): use the current branch (`git branch --show-current`). A detached HEAD is an error: stop.
- `<title>` / `<description>` omitted: generate them (see steps 7 and 8). Quote them when they contain spaces.
- `--merge`: the user allows merging the PR. Merging happens only in step 11 and only with this flag.
- Stop with a usage message if the destination is missing, or if source equals destination.

## Procedure

Stop-and-warn steps are marked **STOP**. Errors from commands are handled by the retry policy in step 10.

### 0. Preflight (STOP on failure, not retryable)
- Inside a git work tree: `git rev-parse --is-inside-work-tree`.
- `gh` is installed and logged in: `gh auth status`.
- A GitHub `origin` remote exists: `git remote get-url origin`.

### 1. Fetch remote state
- `git fetch origin --prune` so `origin/*` refs are current. This updates remote-tracking refs only.

### 2. Branches exist locally and remotely (STOP if missing)
For both source and destination:
- Local: `git rev-parse --verify --quiet refs/heads/<branch>`.
- Remote: `git ls-remote --exit-code --heads origin <branch>`.

Report exactly which branch is missing where.

### 3. No uncommitted work (STOP)
- `git status --porcelain` must print nothing. This includes untracked files. If anything is listed, show the list of paths (not their contents) and tell the user to commit or stash first.

### 4. Source in sync with its remote (STOP)
- `git rev-parse <source>` must equal `git rev-parse origin/<source>`.
- If they differ, report whether the local branch is ahead (unpushed commits), behind, or diverged, and stop. This skill does not push.

### 5. Duplicate PR check (report and stop, not an error)
- `gh pr list --head <source> --base <destination> --state open --json number,title,url`.
- If one exists, tell the user its number and URL and stop. Do not create a second one.

### 6. Merge conflict check (STOP, without showing conflicts)
- `git merge-tree --write-tree origin/<destination> origin/<source> >/dev/null 2>&1; echo $?`
  - `0`: clean, continue.
  - `1`: conflicts. Stop and say only: "The branches have conflicts that cannot be merged automatically. Please merge `<destination>` into `<source>` (or the reverse) manually, resolve the conflicts, and run the command again." Do **not** print the conflicting files or the merge output.
  - anything else: stop and report that the check failed (possibly an old git version that lacks `--write-tree`).
- This check does not touch the working tree or the index.

### 7. Commit range and title
- Commits to include: `git log --no-merges --format='%h %s' origin/<destination>..origin/<source>`. If empty, stop: there is nothing to propose.
- Diff summary: `git diff --stat origin/<destination>...origin/<source>`.
- Unrelated commits: look at the conventional type and scope of each subject and at the top-level directories it touches. A commit is "possibly unrelated" if its scope or directory differs from the dominant one of the range. If any exist, ask the user with AskUserQuestion whether to mention them in the description (options: include them as a separate section / leave them out / cancel).
- Title, if not given: a conventional title in the form `<type>(<scope>): <imperative description>`, at most 72 characters, lowercase after the colon, no trailing period.
  - One commit in the range: reuse its subject.
  - Several commits: derive the dominant type and scope from the subjects, and describe the work from the branch name (e.g. `feat/score-logic-update` → `feat: score logic update`).
  - Example of a good title: `feat(CR2): lock the blocklist while a timer session is active`.

### 8. Description, if not given
Write Markdown to a file in the scratchpad directory (`/tmp/claude-1000/-home-lain-Documents-agent-workspace-build-it-timer/fe692a0b-afb2-41b0-8bb4-52766f1f08f0/scratchpad/pr-body.md`) so quoting is never a problem. Structure:

```markdown
## Summary
<2–4 sentences: what the change does and why, based on the commit subjects and the diff stat>

## Commits
- <short hash> <subject>
...

## Notes
<only if the user chose to mention unrelated commits, or if there is something a reviewer must know>

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Do not invent behaviour that the commits do not show. Keep the attribution line at the end, as required for pull request descriptions.

### 9. Create the PR
Run:

```
gh pr create --base <destination> --head <source> --title "<title>" --body-file <body-file>
```

On success, print the PR number and URL that `gh` returns.

### 10. Retry policy
- **Retryable** (retry up to 3 times after the first attempt, waiting 5 s, 10 s, 20 s between attempts): network or timeout errors, HTTP 5xx, GitHub API rate limits ("secondary rate limit", HTTP 403/429 with a retry hint), "could not resolve host", transient "try again" messages.
- **Not retryable** (stop immediately and warn the user): not authenticated, no push/write permission, base or head branch not found, validation errors such as "No commits between", "head branch must be pushed", or a bad argument.
- If the error is "a pull request for branch ... already exists", treat it as the duplicate case: look up that PR with `gh pr list --head <source> --state open --json number,url` and report it.
- After the retries are exhausted, stop and report the last error.

### 11. Merge (only with `--merge`)
- Without `--merge`, stop after step 9 and report the PR. Never merge on your own initiative.
- With `--merge`: check `gh pr view <number> --json mergeable,mergeStateStatus`. If it is not `MERGEABLE`, stop and warn the user; do not force it.
- Merge with `gh pr merge <number> --merge` (a merge commit; no `--admin`, no `--delete-branch`, no `--squash` or `--rebase` unless the user asks for those).
- Retry it under the same retry policy. Report the merge result.

## Report
At the end, report: source and destination, the PR number and URL (or the existing PR for a duplicate), the title used, whether the title and description were generated, and whether the PR was merged. For every stop, state which check failed and what the user should do next.

## Scope limits
- This skill does not commit, does not push, and does not change local branches. `git merge`, `git rebase`, and `git reset` are never used.
- Merging happens only through `gh pr merge` with `--merge`, after the PR exists.
