# Design System Architecture

## Overview

The video2md application uses a comprehensive design system built on top of shadcn/ui components with Tailwind CSS. This design system provides a consistent, accessible, and maintainable foundation for the application's user interface.

## Current Architecture

### 1. Component Structure

The design system is organized into several key areas:

```
components/
├── ui/                  # Core UI components (shadcn/ui based)
│   ├── button.tsx       # Button component with variants
│   ├── card.tsx         # Card component with sub-components
│   ├── input.tsx        # Input field component
│   ├── badge.tsx        # Badge component with variants
│   ├── step-indicator.tsx # Custom step indicator
│   ├── sidebar.tsx      # Complex sidebar component system
│   └── ... (other Radix UI wrapped components)
├── theme-provider.tsx   # Theme management
├── theme-toggle.tsx     # Theme switching UI
├── transcript-form.tsx  # Domain-specific form component
└── analyze/             # Domain-specific analysis components
```

### 2. Technology Stack

- **UI Framework**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4 with custom variants
- **Theming**: Next.js themes with light/dark mode support
- **Utility Library**: class-variance-authority for component variants
- **Class Merging**: clsx + tailwind-merge via `cn()` utility

### 3. Key Design System Components

#### Core UI Components

1. **Button**: Highly configurable button with variants (default, destructive, outline, secondary, ghost, link) and sizes (default, sm, lg, icon variants)
2. **Card**: Comprehensive card system with header, footer, title, description, and action sub-components
3. **Input**: Styled input field with focus states and validation support
4. **Badge**: Status indicator with multiple variants
5. **Step Indicator**: Custom progress indicator for workflows

#### Complex Components

1. **Sidebar**: Advanced sidebar system with:
   - Collapsible states (expanded/collapsed)
   - Mobile responsiveness with sheet overlay
   - Multiple variants (sidebar, floating, inset)
   - Keyboard shortcuts and accessibility features
   - Comprehensive sub-component system (header, footer, menu, groups, etc.)

### 4. Design Tokens

The design system uses CSS custom properties for theming, defined in `styles/globals.css`:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  /* Dark mode variants of all tokens */
}
```

### 5. Utility Functions

- **`cn()`**: Class name merging utility combining `clsx` and `tailwind-merge`
- **`cva()`**: Class variance authority for creating component variants

## Design System Principles

### 1. Component Composition

The design system follows a composition-based approach where complex components are built from simpler primitives. For example:

- Card component is composed of Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Sidebar system has over 20 sub-components working together

### 2. Variant System

Components use a variant system powered by `class-variance-authority`:

```typescript
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "...", outline: "..." },
    size: { default: "...", sm: "...", lg: "..." }
  },
  defaultVariants: { variant: "default", size: "default" }
});
```

### 3. Accessibility

- All components include proper ARIA attributes
- Keyboard navigation support
- Focus management
- Color contrast compliance
- Semantic HTML structure

### 4. Responsive Design

- Mobile-first approach
- Responsive variants using Tailwind breakpoints
- Touch target sizing
- Adaptive layouts

### 5. Theming

- Light/dark mode support via Next.js themes
- CSS custom properties for dynamic theming
- Theme-aware component variants

## Component Categories

### 1. Primitives

Basic building blocks that don't include any business logic:

- Button
- Input
- Card
- Badge
- Separator
- Skeleton
- Tooltip
- Dialog
- Sheet

### 2. Composite Components

Components composed of multiple primitives with coordinated behavior:

- Sidebar (with all its sub-components)
- Step Indicator
- Transcript Form
- Analysis Panels

### 3. Domain-Specific Components

Components that include business logic or are specific to the video2md domain:

- TranscriptFetcher
- AnalysisPanel
- SlidesPanel
- SuperAnalysisPanel

## Design System Implementation Plan

### Phase 1: Documentation (Current)

1. **Complete current state analysis** ✅
2. **Create comprehensive architecture documentation** ✅
3. **Document component usage patterns**
4. **Establish contribution guidelines**

### Phase 2: Component Inventory

1. **Create visual component library**
2. **Document all component props and variants**
3. **Create usage examples for each component**
4. **Establish component status (stable, beta, deprecated)**

### Phase 3: Design Tokens System

1. **Formalize design token structure**
2. **Create token documentation**
3. **Establish token usage guidelines**
4. **Create token generation scripts**

### Phase 4: Accessibility Standards

1. **Document accessibility requirements**
2. **Create accessibility testing guidelines**
3. **Establish ARIA patterns**
4. **Create color contrast standards**

### Phase 5: Implementation Guidelines

1. **Component creation process**
2. **Variant addition process**
3. **Deprecation policy**
4. **Versioning strategy**

## Best Practices

### 1. Component Creation

```typescript
// Good: Using proper typing and variant system
function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
```

### 2. Styling Approach

```typescript
// Good: Using cva for variants
const componentVariants = cva("base-styles", {
  variants: {
    variant: { default: "...", secondary: "..." },
    size: { default: "...", sm: "..." }
  }
});

// Good: Using cn() for class merging
className={cn("base-classes", variantClasses, className)}
```

### 3. Accessibility

```typescript
// Good: Proper ARIA attributes
<div 
  role="button" 
  aria-label="Toggle sidebar" 
  tabIndex={0} 
  onClick={toggleSidebar}
  onKeyDown={(e) => e.key === 'Enter' && toggleSidebar()}
/>
```

### 4. Documentation

```typescript
/**
 * Button component with multiple variants and sizes
 * @param variant - Visual variant (default, destructive, outline, etc.)
 * @param size - Button size (default, sm, lg, icon variants)
 * @param asChild - Render as child component using Slot
 * @returns React button element
 */
function Button({ variant, size, asChild, ...props }) { ... }
```

## Future Enhancements

1. **Design System Website**: Interactive component browser
2. **Automated Testing**: Visual regression testing for components
3. **Token Studio Integration**: Design token management
4. **Storybook Integration**: Component development environment
5. **Figma Library**: Design system source of truth

## Conclusion

The video2md design system provides a robust foundation for building consistent, accessible, and maintainable user interfaces. By following the established patterns and principles, developers can efficiently create new components while maintaining design consistency across the application.