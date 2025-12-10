# Creating GitHub Issues from TODOs

This directory contains scripts and documentation for converting TODO comments in the codebase to GitHub issues.

## Files

- **`create-todo-issues.sh`**: Bash script to automatically create all TODO-related GitHub issues
- **`../TODOS.md`**: Detailed documentation of all TODOs found in the codebase

## Prerequisites

1. Install GitHub CLI: https://cli.github.com/
2. Authenticate with GitHub: `gh auth login`

## Usage

### Option 1: Automated Creation (Recommended)

Run the provided script to create all issues at once:

```bash
./scripts/create-todo-issues.sh
```

This will create 6 issues with appropriate labels and descriptions.

### Option 2: Manual Creation

Review the detailed documentation in `TODOS.md` and create issues manually through:

- GitHub web interface: https://github.com/remiconnesson/v0-video2md/issues/new
- GitHub CLI for individual issues:
  ```bash
  gh issue create --title "Issue Title" --body "Issue description" --label "label1,label2"
  ```

## After Creating Issues

Once the issues are created, you can:

1. Update TODO comments in the code to reference the issue numbers
2. Close issues as they are resolved
3. Use issue references in commit messages (e.g., "fixes #123")

## TODOs Summary

The script will create the following 6 issues:

1. **Refactor AnalyzeView component state machine** (Medium Priority)
   - Location: `components/analyze/analyze-view.tsx`
   - Labels: refactor, component, technical-debt

2. **Fix blinking issue in AnalyzeView when hasRuns is false** (Medium Priority)
   - Location: `components/analyze/analyze-view.tsx`
   - Labels: bug, ui, component

3. **Review navigation approach in TranscriptFetcher component** (Low Priority)
   - Location: `components/transcript-form.tsx`
   - Labels: enhancement, component

4. **Add tests for parseVersion function** (High Priority)
   - Location: `app/video/youtube/[youtubeId]/analyze/page.tsx`
   - Labels: testing, enhancement

5. **Document why version parsing is done in the page component** (Low Priority)
   - Location: `app/video/youtube/[youtubeId]/analyze/page.tsx`
   - Labels: documentation

6. **Remove duplicate version validation in analyze page** (Medium Priority)
   - Location: `app/video/youtube/[youtubeId]/analyze/page.tsx`
   - Labels: refactor, bug, technical-debt

## Troubleshooting

- **Authentication Error**: Run `gh auth login` and follow the prompts
- **Permission Denied**: Ensure you have write access to the repository
- **Script Not Executable**: Run `chmod +x scripts/create-todo-issues.sh`
