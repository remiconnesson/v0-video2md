# Opportunities for React Improvement

This document outlines extensive opportunities to improve the React and Next.js codebase of `video2md`, based on Vercel Engineering best practices, React 19 standards, and web design guidelines.

## 1. Todo List

### Performance & Data Fetching
- [ ] **Eliminate Waterfall in `AnalyzeLayout`**
- [ ] **Implement Server-Side Pre-fetching for `ProcessedVideosList`**
- [ ] **Optimize `useStreamingFetch` with `eventsource-parser`**
- [ ] **Parallelize Data Fetching in Workflows**

### Component Architecture & Maintainability
- [ ] **Extract Shared `SectionContent` and `SectionSkeleton` Components**
- [ ] **Unify `Thumbnail` Component with Variants**
- [ ] **Refactor Large Panel Components into "Dumb" Sub-components**
- [ ] **Implement Global Error Boundaries**
- [ ] **Standardize API Route Parameter Handling with `RouteContext` Helpers**

### Accessibility & UX
- [ ] **Add `aria-label` to all Icon-only Buttons**
- [ ] **Improve Image `alt` Text with Contextual Data**
- [ ] **Implement `useOptimistic` for Slide Selection Feedback**
- [ ] **Replace Native Checkboxes with Styled Radix UI Components**
- [ ] **Enhance Form Field Validation and Placeholder Patterns**

### Typography & Polish
- [ ] **Global Typography Standardization (Ellipses and Curly Quotes)**
- [ ] **Ensure Consistent Loading State Indicators**

---

## 2. Opportunity Details

### Eliminate Waterfall in `AnalyzeLayout`
- **File Involved**: `app/video/youtube/[youtubeId]/analyze/layout.tsx`
- **Rationale**: Currently, `fetchAndSaveTranscript` is awaited before other database queries (`getCompletedAnalysis`, `hasSlideAnalysisResults`).
- **Skills Reference**: `async-parallel` (Eliminating Waterfalls)
- **Reasoning**: These queries are independent. Using `Promise.all` can significantly reduce the initial page load time by fetching transcript data and checking analysis status concurrently.
- **Next Steps**: Refactor `AnalyzeLayout` to use `Promise.all` for all initial data fetching.

### Implement Server-Side Pre-fetching for `ProcessedVideosList`
- **Files Involved**: `app/page.tsx`, `components/processed-videos-list.tsx`
- **Rationale**: The videos list is currently fetched only on the client-side via `useQuery` (fetch-on-mount).
- **Skills Reference**: `client-swr-dedup` / Next.js Server Components.
- **Reasoning**: Pre-fetching the initial list of videos in the Server Component and passing it as `initialData` to `useQuery` improves SEO and makes the page feel much faster (FCP).
- **Next Steps**: Fetch the initial video list in `app/page.tsx` and pass it to `ProcessedVideosList`.

### Optimize `useStreamingFetch` with `eventsource-parser`
- **File Involved**: `lib/sse.ts`, `lib/use-streaming-fetch.ts`
- **Rationale**: The current SSE implementation manually parses lines and handles buffers.
- **Skills Reference**: `js-cache-property-access` / Reliability.
- **Reasoning**: Using a battle-tested library like `eventsource-parser` (already in `package.json`) provides more robust handling of fragmented packets and diverse SSE formats.
- **Next Steps**: Refactor `consumeSSE` to utilize the `eventsource-parser` library.

### Extract Shared `SectionContent` and `SectionSkeleton` Components
- **Files Involved**: `components/analyze/analysis-panel.tsx`, `components/analyze/super-analysis-panel.tsx`
- **Rationale**: High degree of code duplication in rendering AI analysis sections and their loading states.
- **Skills Reference**: `architecture-compound-components` (Component Architecture).
- **Reasoning**: Centralizing this logic ensures consistent markdown rendering and easier maintenance of UI patterns.
- **Next Steps**: Create `components/analyze/shared/section-content.tsx` and `components/analyze/shared/section-skeleton.tsx`.

### Unify `Thumbnail` Component with Variants
- **Files Involved**: `components/processed-videos-list.tsx`, `components/analyze/video-info-card.tsx`
- **Rationale**: Multiple similar `ThumbnailCell` implementations exist with slightly different styling logic.
- **Skills Reference**: `architecture-avoid-boolean-props` (using variants instead).
- **Reasoning**: A single `Thumbnail` component with size/layout variants (e.g., 'table' vs 'card') reduces CSS duplication and ensures consistent fallback behavior.
- **Next Steps**: Extract a shared `Thumbnail` component to `components/ui/thumbnail.tsx`.

### Add `aria-label` to all Icon-only Buttons
- **Files Involved**: `components/analyze/slides-panel.tsx`, `components/analyze/zoom-dialog.tsx`, `components/analyze/analysis-panel.tsx`
- **Rationale**: Several buttons containing only icons (Help, Close, ExternalLink) lack descriptive labels for screen readers.
- **Skills Reference**: `Web Design Guidelines -> Accessibility`.
- **Reasoning**: Compliance with accessibility standards is critical for inclusive design.
- **Next Steps**: Audit all components for icon-only buttons and add appropriate `aria-label` props.

### Global Typography Standardization
- **Files Involved**: Entire codebase (especially `TranscriptFetcher`, `ProcessedVideosList`, `SlidesPanel`).
- **Rationale**: Inconsistent use of `...` vs `…` and straight vs curly quotes.
- **Skills Reference**: `Web Design Guidelines -> Typography`.
- **Reasoning**: Professional typography improves perceived quality. Guidelines explicitly require `…` and curly quotes.
- **Next Steps**: Run a global search-and-replace for `...` to `…` and audit key headings/buttons for curly quote usage.

### Implement `useOptimistic` for Slide Selection Feedback
- **File Involved**: `components/analyze/slides-panel.tsx`
- **Rationale**: Selecting a slide involves a server mutation with a slight delay before the UI reflects the change.
- **Skills Reference**: `react19-` (React 19 APIs).
- **Reasoning**: `useOptimistic` allows the UI to update immediately while the mutation is in progress, providing a "snappy" feel.
- **Next Steps**: Refactor the slide picking logic to use `useOptimistic` in conjunction with TanStack Query mutations.

### Replace Native Checkboxes with Styled Radix UI Components
- **File Involved**: `components/analyze/slides-panel.tsx`, `components/analyze/slide-card.tsx`
- **Rationale**: Current slide selection and confirmation use native HTML checkboxes.
- **Skills Reference**: `Web Interface Guidelines -> Focus States` / UI Consistency.
- **Reasoning**: Using `shadcn/ui` (Radix) Checkbox provides better keyboard navigation, focus indicators, and theme consistency.
- **Next Steps**: Implement a `Checkbox` UI component and replace native inputs.

### Implement Global Error Boundaries
- **Files Involved**: `app/layout.tsx`, or specific route layouts.
- **Rationale**: No explicit Error Boundaries are visible to handle runtime React crashes gracefully.
- **Skills Reference**: `Server-Side Performance` / Reliability.
- **Reasoning**: Prevents the entire app from going white on a component-level error.
- **Next Steps**: Add `error.tsx` files to major route segments and wrap experimental components in Error Boundaries.

### Enhance Form Field Validation and Placeholder Patterns
- **File Involved**: `components/transcript-form.tsx`
- **Rationale**: Placeholder and validation feedback don't fully align with the latest design guidelines.
- **Skills Reference**: `Web Design Guidelines -> Forms`.
- **Reasoning**: Guidelines suggest placeholders should end with `…` and include an example pattern.
- **Next Steps**: Update `TranscriptFetcher` placeholders and ensure error messages focus on actionable steps.

### Refactor Large Panel Components into "Dumb" Sub-components
- **Files Involved**: `AnalysisPanel`, `SlidesPanel`, `SuperAnalysisPanel`.
- **Rationale**: These components are accumulating significant layout and logic, making them harder to scan.
- **Skills Reference**: `AGENTS.md -> Dumb components`.
- **Reasoning**: Extracting UI scaffolding into private, single-use sub-components within the same file improves the "narrative readability" of the core logic.
- **Next Steps**: Perform an editorial pass on large components to push low-signal UI scaffolding into private sub-components.

---

## 3. The Prompt to use to create such a document

To recreate or update this document, an AI agent should follow this structured audit process:

### Audit Prompt

> **Role**: Act as an expert Frontend Architect specializing in React 19, Next.js 16, and Vercel Engineering standards.
>
> **Objective**: Perform a comprehensive audit of the codebase to identify opportunities for improvement in performance, architecture, accessibility, and design polish.
>
> **Instructions**:
> 1. **Codebase Exploration**:
>    - Scan `app/`, `components/`, and `lib/` to understand data fetching and component organization.
>    - Identify large components (>200 lines) and duplicated UI logic.
> 2. **Best Practice Alignment**:
>    - Reference `.agents/skills/vercel-react-best-practices/` for performance rules (waterfalls, bundle size).
>    - Reference `.agents/skills/vercel-composition-patterns/` for component architecture.
>    - Consult the latest [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
> 3. **Specific Audit Checkpoints**:
>    - **Performance**: Look for sequential awaits in layouts/actions and client-side-only fetches that could be pre-fetched.
>    - **Accessibility**: Check for icon-only buttons without labels, missing alt text, and semantic HTML usage.
>    - **Forms**: Verify placeholder patterns, validation feedback, and autocomplete usage.
>    - **Typography**: Check for standard ellipsis (`…`) and curly quote usage.
>    - **Consistency**: Identify where native elements are used instead of established UI library components.
> 4. **Output Format**:
>    - **Section 1: Todo List**: A high-level markdown checklist of improvements.
>    - **Section 2: Opportunity Details**: For each item, provide:
>      - **File Involved**: Specific file path.
>      - **Rationale**: Short explanation of the benefit.
>      - **Skills Reference**: The specific rule or guideline being followed.
>      - **Reasoning**: In-depth technical justification.
>      - **Next Steps**: Actionable instructions for an implementation agent.

### Verification Steps for the Auditor
- Ensure every "Rationale" points to a tangible improvement (TTI, FCP, Accessibility Score).
- Verify that "Next Steps" are specific enough for another agent to execute without further research.
- Double-check that all typography findings follow the "professional polish" guidelines (e.g., `…` vs `...`).
