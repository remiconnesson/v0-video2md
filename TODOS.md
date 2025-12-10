# TODOs to Convert to GitHub Issues

This document lists all TODO comments found in the codebase that should be converted to GitHub issues.

## Issue 1: Refactor AnalyzeView component state machine

**File:** `components/analyze/analyze-view.tsx:32-35`

**Priority:** Medium

**Description:**
The AnalyzeView component has an implicit state machine that is clunky, hard to read and reason about. This needs to be refactored for better maintainability.

**Context:**
```typescript
/**
 * TODO: There's something I don't like about this component sub tree,
 * it's like there's an implicit state machine there...
 * but it's clunky, hard to read and reason about
 **/
const [rerollOpen, setRerollOpen] = useState(false);
```

**Suggested Actions:**
- Analyze the component's state flow
- Consider extracting state logic into a custom hook or state machine library
- Improve code readability and maintainability

---

## Issue 2: Fix blinking issue in AnalyzeView when hasRuns is false

**File:** `components/analyze/analyze-view.tsx:106-108`

**Priority:** Medium

**Description:**
There's a visual blinking issue where the component starts at `!hasRuns` even when runs exist. This should probably be pushed to the server or use React Suspense.

**Context:**
```typescript
{/* TODO this blinks somehow, seems that we start at !hasRuns even if we have runs
  This should probably be pushed on the server / use suspense
  */}
{!hasRuns && !isAnalysisRunning && (
  <EmptyState handleStartAnalysis={handleStartAnalysis} />
)}
```

**Suggested Actions:**
- Investigate the root cause of the blinking
- Consider server-side rendering or React Suspense
- Ensure proper loading states

---

## Issue 3: Review navigation approach in TranscriptFetcher component

**File:** `components/transcript-form.tsx:15-18`

**Priority:** Low

**Description:**
The current navigation implementation uses `useEffect` which might not be the best approach. This needs investigation (estimated time: <5 min).

**Context:**
```typescript
/* TODO: is this the good way to do the navigation?
   Seems dirty to use useEffect here.
   investigation time <5 min
*/
useEffect(() => {
  if (state?.success && state?.videoId) {
    // navigate to the video page after validating video id
    router.push(`/video/youtube/${state.videoId}/analyze`);
  }
}, [state?.success, state?.videoId, router]);
```

**Suggested Actions:**
- Research best practices for navigation with Next.js App Router and useActionState
- Consider alternative approaches (e.g., server actions with redirect)
- Update implementation if a better approach exists

---

## Issue 4: Add tests for parseVersion function

**File:** `app/video/youtube/[youtubeId]/analyze/page.tsx:6-7`

**Priority:** High

**Description:**
The `parseVersion` function lacks tests. Tests should verify the function itself and that the component calls it correctly.

**Context:**
```typescript
// TODO test this
// and also test that the component is calling this function
export function parseVersion(v?: string): number | undefined {
  const version = v ? parseInt(v, 10) : undefined;
  if (version && version < 1) {
    throw new Error("Version must be greater than or equal to 1");
  }
  return version;
}
```

**Suggested Actions:**
- Create test file for the analyze page
- Test parseVersion with various inputs (undefined, valid numbers, invalid numbers, numbers < 1)
- Test integration with the page component

---

## Issue 5: Document why version parsing is done in the page component

**File:** `app/video/youtube/[youtubeId]/analyze/page.tsx:9`

**Priority:** Low

**Description:**
Add documentation explaining the reasoning for parsing the version parameter at the page level.

**Context:**
```typescript
export function parseVersion(v?: string): number | undefined {
  // TODO: add why we do care about parsing version this here
  const version = v ? parseInt(v, 10) : undefined;
  // ...
}
```

**Suggested Actions:**
- Add a clear comment explaining the architecture decision
- Document the flow of version handling

---

## Issue 6: Remove duplicate version validation

**File:** `app/video/youtube/[youtubeId]/analyze/page.tsx:26-27`

**Priority:** Medium

**Description:**
There's duplicate validation logic. The `parseVersion` function already validates that version >= 1, but the page component parses version again without using the validation function.

**Context:**
```typescript
const { v } = await searchParams;
// TODO: version shouldn't be less than 1
const version = v ? parseInt(v, 10) : undefined;
```

The `parseVersion` function above already handles this validation but is not being used.

**Suggested Actions:**
- Use the `parseVersion` function instead of manual parsing
- Remove duplicate validation logic
- Ensure consistent version handling throughout the component

---

## How to Create Issues

You can use the provided script `scripts/create-todo-issues.sh` or manually create issues using the GitHub CLI:

```bash
# Example for Issue 1
gh issue create \
  --title "Refactor AnalyzeView component state machine" \
  --body "$(cat issue-1-details.md)" \
  --label "refactor,component"
```

Or create them through the GitHub web interface using the descriptions above.
