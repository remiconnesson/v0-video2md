# Instructions: Creating GitHub Issues from TODOs

## Summary

I've prepared everything needed to convert the 6 TODO comments found in the codebase into GitHub issues. Due to environment limitations, I cannot directly create GitHub issues, but I've provided:

1. **Comprehensive Documentation** (`TODOS.md`)
2. **Automated Creation Script** (`scripts/create-todo-issues.sh`)
3. **Usage Instructions** (`scripts/README.md`)
4. **Updated Code** - All TODO comments now reference the tracking documentation

## Quick Start

### Option 1: Automated (Recommended)

Run the provided script to create all 6 issues at once:

```bash
# Ensure you're authenticated with GitHub CLI
gh auth login

# Run the script
./scripts/create-todo-issues.sh
```

This will create all 6 issues with proper titles, descriptions, labels, and priorities.

### Option 2: Manual Creation

If you prefer to review and create issues manually:

1. Review the detailed documentation in `TODOS.md`
2. Go to https://github.com/remiconnesson/v0-video2md/issues/new
3. Copy the title and description for each issue from `TODOS.md`
4. Add the suggested labels
5. Create the issue

## After Creating Issues

Once the issues are created, you can optionally update the TODO comments in the code to reference the actual issue numbers:

```typescript
// TODO: Component needs refactoring
// Tracked in TODOS.md - Issue #1
```

Can become:

```typescript
// TODO: Component needs refactoring
// See issue #123
```

## Issue Summary

The script will create 6 issues:

| # | Title | Priority | Labels | File |
|---|-------|----------|--------|------|
| 1 | Refactor AnalyzeView component state machine | Medium | refactor, component, technical-debt | components/analyze/analyze-view.tsx |
| 2 | Fix blinking issue in AnalyzeView when hasRuns is false | Medium | bug, ui, component | components/analyze/analyze-view.tsx |
| 3 | Review navigation approach in TranscriptFetcher component | Low | enhancement, component | components/transcript-form.tsx |
| 4 | Add tests for parseVersion function | High | testing, enhancement | app/video/youtube/[youtubeId]/analyze/page.tsx |
| 5 | Document why version parsing is done in the page component | Low | documentation | app/video/youtube/[youtubeId]/analyze/page.tsx |
| 6 | Remove duplicate version validation in analyze page | Medium | refactor, bug, technical-debt | app/video/youtube/[youtubeId]/analyze/page.tsx |

## Verification

After running the script, verify the issues were created:

```bash
gh issue list --repo remiconnesson/v0-video2md
```

## Questions?

- For detailed issue descriptions, see `TODOS.md`
- For script usage, see `scripts/README.md`
- For GitHub CLI help, run `gh issue create --help`
