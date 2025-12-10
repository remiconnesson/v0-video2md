#!/bin/bash

# Script to create GitHub issues from TODOs found in the codebase
# This script requires GitHub CLI (gh) to be installed and authenticated
# Usage: ./create-todo-issues.sh [repository]
# Example: ./create-todo-issues.sh remiconnesson/v0-video2md

set -e
set -o pipefail

REPO="${1:-remiconnesson/v0-video2md}"

echo "Creating GitHub issues for TODOs in $REPO..."
echo ""

# Issue 1: Refactor AnalyzeView component state machine
echo "Creating Issue 1: Refactor AnalyzeView component state machine..."
gh issue create \
  --repo "$REPO" \
  --title "Refactor AnalyzeView component state machine" \
  --label "refactor,component,technical-debt" \
  --body "## Description
The AnalyzeView component has an implicit state machine that is clunky, hard to read and reason about. This needs to be refactored for better maintainability.

## Location
\`components/analyze/analyze-view.tsx:32-35\`

## Current Code
\`\`\`typescript
/**
 * TODO: There's something I don't like about this component sub tree,
 * it's like there's an implicit state machine there...
 * but it's clunky, hard to read and reason about
 **/
const [rerollOpen, setRerollOpen] = useState(false);
\`\`\`

## Suggested Actions
- Analyze the component's state flow
- Consider extracting state logic into a custom hook or state machine library
- Improve code readability and maintainability

## Priority
Medium"

echo ""

# Issue 2: Fix blinking issue in AnalyzeView
echo "Creating Issue 2: Fix blinking issue in AnalyzeView when hasRuns is false..."
gh issue create \
  --repo "$REPO" \
  --title "Fix blinking issue in AnalyzeView when hasRuns is false" \
  --label "bug,ui,component" \
  --body "## Description
There's a visual blinking issue where the component starts at \`!hasRuns\` even when runs exist. This should probably be pushed to the server or use React Suspense.

## Location
\`components/analyze/analyze-view.tsx:106-108\`

## Current Code
\`\`\`typescript
{/* TODO this blinks somehow, seems that we start at !hasRuns even if we have runs
  This should probably be pushed on the server / use suspense
  */}
{!hasRuns && !isAnalysisRunning && (
  <EmptyState handleStartAnalysis={handleStartAnalysis} />
)}
\`\`\`

## Suggested Actions
- Investigate the root cause of the blinking
- Consider server-side rendering or React Suspense
- Ensure proper loading states

## Priority
Medium"

echo ""

# Issue 3: Review navigation approach in TranscriptFetcher
echo "Creating Issue 3: Review navigation approach in TranscriptFetcher component..."
gh issue create \
  --repo "$REPO" \
  --title "Review navigation approach in TranscriptFetcher component" \
  --label "enhancement,component" \
  --body "## Description
The current navigation implementation uses \`useEffect\` which might not be the best approach. This needs investigation (estimated time: <5 min).

## Location
\`components/transcript-form.tsx:15-18\`

## Current Code
\`\`\`typescript
/* TODO: is this the good way to do the navigation?
   Seems dirty to use useEffect here.
   investigation time <5 min
*/
useEffect(() => {
  if (state?.success && state?.videoId) {
    // navigate to the video page after validating video id
    router.push(\`/video/youtube/\${state.videoId}/analyze\`);
  }
}, [state?.success, state?.videoId, router]);
\`\`\`

## Suggested Actions
- Research best practices for navigation with Next.js App Router and useActionState
- Consider alternative approaches (e.g., server actions with redirect)
- Update implementation if a better approach exists

## Priority
Low"

echo ""

# Issue 4: Add tests for parseVersion function
echo "Creating Issue 4: Add tests for parseVersion function..."
gh issue create \
  --repo "$REPO" \
  --title "Add tests for parseVersion function" \
  --label "testing,enhancement" \
  --body "## Description
The \`parseVersion\` function lacks tests. Tests should verify the function itself and that the component calls it correctly.

## Location
\`app/video/youtube/[youtubeId]/analyze/page.tsx:6-15\`

## Current Code
\`\`\`typescript
// TODO test this
// and also test that the component is calling this function
export function parseVersion(v?: string): number | undefined {
  const version = v ? parseInt(v, 10) : undefined;
  if (version && version < 1) {
    throw new Error(\"Version must be greater than or equal to 1\");
  }
  return version;
}
\`\`\`

## Suggested Actions
- Create test file for the analyze page
- Test parseVersion with various inputs (undefined, valid numbers, invalid numbers, numbers < 1)
- Test integration with the page component

## Priority
High"

echo ""

# Issue 5: Document version parsing rationale
echo "Creating Issue 5: Document why version parsing is done in the page component..."
gh issue create \
  --repo "$REPO" \
  --title "Document why version parsing is done in the page component" \
  --label "documentation" \
  --body "## Description
Add documentation explaining the reasoning for parsing the version parameter at the page level.

## Location
\`app/video/youtube/[youtubeId]/analyze/page.tsx:9\`

## Current Code
\`\`\`typescript
export function parseVersion(v?: string): number | undefined {
  // TODO: add why we do care about parsing version this here
  const version = v ? parseInt(v, 10) : undefined;
  // ...
}
\`\`\`

## Suggested Actions
- Add a clear comment explaining the architecture decision
- Document the flow of version handling

## Priority
Low"

echo ""

# Issue 6: Remove duplicate version validation
echo "Creating Issue 6: Remove duplicate version validation..."
gh issue create \
  --repo "$REPO" \
  --title "Remove duplicate version validation in analyze page" \
  --label "refactor,bug,technical-debt" \
  --body "## Description
There's duplicate validation logic. The \`parseVersion\` function already validates that version >= 1, but the page component parses version again without using the validation function.

## Location
\`app/video/youtube/[youtubeId]/analyze/page.tsx:26-27\`

## Current Code
\`\`\`typescript
const { v } = await searchParams;
// TODO: version shouldn't be less than 1
const version = v ? parseInt(v, 10) : undefined;
\`\`\`

The \`parseVersion\` function above already handles this validation but is not being used.

## Suggested Actions
- Use the \`parseVersion\` function instead of manual parsing
- Remove duplicate validation logic
- Ensure consistent version handling throughout the component

## Priority
Medium"

echo ""
echo "✅ All issues created successfully!"
echo ""
echo "To view the created issues, run:"
echo "  gh issue list --repo $REPO"
