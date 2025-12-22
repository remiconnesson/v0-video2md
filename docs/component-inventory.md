# Component Inventory

## Core UI Components

### Button

**Location**: [`components/ui/button.tsx`](components/ui/button.tsx)

**Description**: Primary interactive element with multiple variants and sizes.

**Variants**:
- `default`: Primary action button
- `destructive`: Dangerous action button
- `outline`: Secondary action with border
- `secondary`: Alternative primary action
- `ghost`: Subtle action button
- `link`: Text-based action

**Sizes**:
- `default`: Standard button size
- `sm`: Small button
- `lg`: Large button
- `icon`: Square button for icons
- `icon-sm`: Small icon button
- `icon-lg`: Large icon button

**Props**:
```typescript
{
  className?: string,
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link",
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg",
  asChild?: boolean,
  ...props: React.ComponentProps<"button">
}
```

**Usage Example**:
```jsx
<Button variant="default" size="lg">Submit</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="icon">
  <Icon />
</Button>
```

### Card

**Location**: [`components/ui/card.tsx`](components/ui/card.tsx)

**Description**: Container component for grouping related content.

**Sub-components**:
- `Card`: Main container
- `CardHeader`: Header section
- `CardTitle`: Title text
- `CardDescription`: Description text
- `CardContent`: Main content area
- `CardFooter`: Footer section
- `CardAction`: Action area (positioned in header)

**Props**:
```typescript
{
  className?: string,
  ...props: React.ComponentProps<"div">
}
```

**Usage Example**:
```jsx
<Card className="w-full max-w-md">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
    <CardAction>
      <Button variant="ghost" size="icon">
        <SettingsIcon />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

### Input

**Location**: [`components/ui/input.tsx`](components/ui/input.tsx)

**Description**: Text input field with styling and validation states.

**Props**:
```typescript
{
  className?: string,
  type?: string,
  ...props: React.ComponentProps<"input">
}
```

**Features**:
- Automatic focus styling
- Validation state support (aria-invalid)
- File input support
- Responsive sizing

**Usage Example**:
```jsx
<Input 
  type="email" 
  placeholder="Enter your email" 
  className="w-full"
/>
```

### Badge

**Location**: [`components/ui/badge.tsx`](components/ui/badge.tsx)

**Description**: Small status indicator or label.

**Variants**:
- `default`: Primary badge
- `secondary`: Secondary badge
- `destructive`: Danger/error badge
- `outline`: Bordered badge

**Props**:
```typescript
{
  className?: string,
  variant?: "default" | "secondary" | "destructive" | "outline",
  asChild?: boolean,
  ...props: React.ComponentProps<"span">
}
```

**Usage Example**:
```jsx
<Badge variant="default">Active</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Pending</Badge>
```

## Composite Components

### Sidebar

**Location**: [`components/ui/sidebar.tsx`](components/ui/sidebar.tsx)

**Description**: Advanced navigation sidebar system with multiple variants and responsive behavior.

**Main Components**:
- `SidebarProvider`: Context provider for sidebar state
- `Sidebar`: Main sidebar container
- `SidebarTrigger`: Button to toggle sidebar visibility
- `SidebarRail`: Resizable handle for sidebar
- `SidebarInset`: Main content area that adapts to sidebar

**Sub-components**:
- `SidebarHeader`, `SidebarFooter`: Header and footer sections
- `SidebarContent`: Scrollable content area
- `SidebarGroup`: Group of related items
- `SidebarGroupLabel`, `SidebarGroupAction`: Group header and actions
- `SidebarMenu`: Navigation menu container
- `SidebarMenuItem`, `SidebarMenuButton`: Menu items
- `SidebarMenuAction`, `SidebarMenuBadge`: Menu item accessories
- `SidebarSeparator`: Visual separator
- `SidebarInput`: Styled input for sidebar

**Variants**:
- `sidebar`: Standard sidebar
- `floating`: Floating sidebar with shadow
- `inset`: Sidebar that pushes content

**Collapsible Options**:
- `offcanvas`: Sidebar slides in/out
- `icon`: Sidebar collapses to icons only
- `none`: Sidebar is always visible

**Features**:
- Mobile responsive (switches to sheet overlay)
- Keyboard shortcut (Ctrl/Cmd + B)
- State persistence via cookies
- Accessible navigation
- Customizable width and positioning

**Usage Example**:
```jsx
<SidebarProvider>
  <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
    <SidebarHeader>
      <h2>Menu</h2>
    </SidebarHeader>
    <SidebarContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive={true}>
            <HomeIcon />
            <span>Home</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarContent>
  </Sidebar>
  <SidebarInset>
    <main>Main content</main>
  </SidebarInset>
  <SidebarTrigger />
  <SidebarRail />
</SidebarProvider>
```

### Step Indicator

**Location**: [`components/ui/step-indicator.tsx`](components/ui/step-indicator.tsx)

**Description**: Progress indicator showing current step in a workflow.

**Props**:
```typescript
{
  currentStep: number,
  totalSteps: number,
  message: string,
  className?: string,
  ...props: React.HTMLAttributes<HTMLDivElement>
}
```

**Usage Example**:
```jsx
<StepIndicator 
  currentStep={2} 
  totalSteps={5} 
  message="Processing transcript"
/>
```

## Domain-Specific Components

### Transcript Form

**Location**: [`components/transcript-form.tsx`](components/transcript-form.tsx)

**Description**: Form for fetching YouTube transcripts.

**Sub-components**:
- `TranscriptFetcher`: Main form container
- `TranscriptForm`: Form with input and submit button
- `ErrorMessage`: Error display component

**Features**:
- YouTube URL/video ID validation
- Loading state management
- Error handling
- Automatic navigation on success

**Usage Example**:
```jsx
<TranscriptFetcher />
```

### Analysis Panels

**Location**: [`components/analyze/`](components/analyze/)

**Components**:
- `AnalysisPanel`: Displays AI-generated analysis
- `SlidesPanel`: Shows extracted slides
- `SuperAnalysisPanel`: Comprehensive analysis view
- `SlideAnalysisPanel`: Detailed slide analysis
- `ZoomDialog`: Image zoom functionality

**Features**:
- Real-time analysis streaming
- Slide extraction visualization
- Interactive analysis tools
- Responsive layouts

## Utilities

### cn() - Class Name Utility

**Location**: [`lib/utils.ts`](lib/utils.ts)

**Description**: Combines clsx and tailwind-merge for robust class name handling.

**Usage**:
```typescript
import { cn } from "@/lib/utils";

// Merge classes with conflict resolution
const classes = cn("text-red-500", "text-blue-500", "font-bold");
// Result: "text-blue-500 font-bold"

// Conditional classes
const classes = cn("base-class", isActive && "active-class");
```

### cva() - Class Variance Authority

**Description**: Creates component variants with type safety.

**Usage**:
```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva("base-classes", {
  variants: {
    variant: {
      primary: "bg-blue-500 text-white",
      secondary: "bg-gray-200 text-gray-800"
    },
    size: {
      sm: "text-sm px-3 py-1",
      lg: "text-lg px-6 py-3"
    }
  },
  defaultVariants: {
    variant: "primary",
    size: "sm"
  }
});

// Usage in component
function Button({ variant, size }) {
  return <button className={buttonVariants({ variant, size })} />;
}
```

## Theming System

### Theme Provider

**Location**: [`components/theme-provider.tsx`](components/theme-provider.tsx)

**Description**: Context provider for theme management.

**Usage**:
```jsx
import { ThemeProvider } from "@/components/theme-provider";

function RootLayout({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

### Theme Toggle

**Location**: [`components/theme-toggle.tsx`](components/theme-toggle.tsx)

**Description**: Button to toggle between light/dark themes.

**Features**:
- Automatic system preference detection
- Smooth transitions
- Accessible labeling

**Usage**:
```jsx
<ThemeToggle />
```

## Design Tokens

The design system uses CSS custom properties defined in [`styles/globals.css`](styles/globals.css):

### Color Tokens

**Light Theme**:
```css
--background: oklch(1 0 0)
--foreground: oklch(0.145 0 0)
--primary: oklch(0.205 0 0)
--primary-foreground: oklch(0.985 0 0)
--secondary: oklch(0.97 0 0)
--destructive: oklch(0.577 0.245 27.325)
--border: oklch(0.922 0 0)
--input: oklch(0.922 0 0)
--ring: oklch(0.708 0 0)
```

**Dark Theme**:
```css
--background: oklch(0.145 0 0)
--foreground: oklch(0.985 0 0)
--primary: oklch(0.985 0 0)
--secondary: oklch(0.269 0 0)
--destructive: oklch(0.396 0.141 25.723)
--border: oklch(0.269 0 0)
--input: oklch(0.269 0 0)
--ring: oklch(0.439 0 0)
```

### Spacing & Radius

```css
--radius: 0.625rem
--radius-sm: calc(var(--radius) - 4px)
--radius-md: calc(var(--radius) - 2px)
--radius-lg: var(--radius)
--radius-xl: calc(var(--radius) + 4px)
```

### Sidebar-Specific Tokens

```css
--sidebar: oklch(0.985 0 0) /* Light */
--sidebar: oklch(0.205 0 0) /* Dark */
--sidebar-foreground: oklch(0.145 0 0) /* Light */
--sidebar-foreground: oklch(0.985 0 0) /* Dark */
--sidebar-primary: oklch(0.205 0 0) /* Light */
--sidebar-primary: oklch(0.488 0.243 264.376) /* Dark */
--sidebar-border: oklch(0.922 0 0) /* Light */
--sidebar-border: oklch(0.269 0 0) /* Dark */
```

## Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Button | Stable | Core component |
| Card | Stable | Core component |
| Input | Stable | Core component |
| Badge | Stable | Core component |
| Step Indicator | Stable | Core component |
| Sidebar | Stable | Complex component |
| Theme Provider | Stable | Core utility |
| Theme Toggle | Stable | Core utility |
| Transcript Form | Stable | Domain-specific |
| Analysis Panels | Stable | Domain-specific |
| cn() utility | Stable | Core utility |
| cva() variants | Stable | Core utility |