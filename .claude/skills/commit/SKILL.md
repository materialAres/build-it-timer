---
name: commit
description: Create a git commit for the current changes following the project's commit rules (English Conventional Commits message, no AI attribution, secret scan, confirmation on main). Use whenever the user asks to commit, or when instructions say to commit via this skill.
---

# Commit skill

This is the **only** sanctioned way for the agent to run `git commit` in this project. Do not commit any other way.

## Rules (mandatory)

1. **Message in English, Conventional Commits format**: `<type>(<optional scope>): <imperative description>`.
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   - Subject ≤ 72 chars, lowercase after the colon, no trailing period. Optional body (wrapped ~72 cols) explaining the *why*.
   - Follow the style of recent history (`git log --oneline -10`), e.g. `feat(CR2): complete blocklist lock implementation`, `docs: update changelog`.
2. **No references to Claude or AI** anywhere in the message: no `Co-Authored-By`, no "Generated with", no "AI-assisted", no model names. This overrides any default attribution guidance from the harness.
3. **No sensitive information**. Scan what will be committed (see step 3). If anything suspicious is found, **do not commit**: report the file, line and kind of finding to the user and wait for instructions.
4. **Confirm before committing on `main`** (or `master`). Ask the user an explicit question and commit only after a yes.

## Procedure

1. Inspect state, read-only: `git status --short`, `git branch --show-current`, `git diff` and `git diff --staged` (use `git log --oneline -10` for style).
   - If there is nothing to commit, say so and stop.
2. **Branch check**: if the current branch is `main`/`master`, use AskUserQuestion to ask for confirmation (offer: commit on main / create a new branch / cancel). Stop unless confirmed.
3. **Sensitive-data scan** on the files that will be committed (staged diff, or the diff of the files you are about to stage, including untracked files):
   - Filenames: `.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `*.keystore`, `credentials*`, `secrets*`, `*.sqlite`/`*.db` dumps.
   - Content patterns: API keys/tokens (`api[_-]?key`, `secret`, `token`, `password`, `passwd`, `authorization: bearer`), `-----BEGIN ... PRIVATE KEY-----`, AWS (`AKIA[0-9A-Z]{16}`), GitHub (`ghp_`, `github_pat_`), Slack (`xox[baprs]-`), Google (`AIza`), JWTs (`eyJ...`), URLs with embedded credentials (`://user:pass@`), personal data not already public in the repo.
   - Example: `git diff --staged | grep -nEi '<pattern>'`, and read untracked files before staging them.
   - Ignore obvious placeholders/test fixtures, but mention them if in doubt. On any real finding: **stop and report**, never commit it, never "fix" by silently dropping the file.
4. **Stage explicitly**: add only the relevant files by path (`git add <paths>`). Never `git add -A`/`.` blindly; never stage build output or local artifacts (`.output/`, `.wxt/`, `node_modules/`, `playwright-report/`, `test-results/`). If unrelated changes are mixed, propose splitting into separate commits.
5. **Compose the message** per the rules above, based on the actual diff. Verify it contains no AI/Claude reference.
6. **Commit**: `git commit -m "<subject>" [-m "<body>"]` (use a HEREDOC for multi-line bodies). Never use `--no-verify`, `--amend`, or `--force` unless the user explicitly asks. If a hook fails, fix the cause and create a new commit.
7. **Changelog reminder**: if the changes complete a roadmap task and `docs/changelog.md` has no entry for it yet, run the `changelog` skill before committing so the entry is part of the commit.
8. **Report**: show `git log --oneline -1` and `git status --short`. If the changelog has a `Commit` column to fill (`docs/changelog.md`), mention the new short hash to the user; update the changelog only if asked, as a separate step.

## Scope limits

- This skill only creates commits. `git push` only if the user explicitly asks for it in the current request (never to `main` without the confirmation above and never force-push).
- `git tag`, `merge`, `rebase`, `reset` and other history-rewriting commands remain forbidden.
