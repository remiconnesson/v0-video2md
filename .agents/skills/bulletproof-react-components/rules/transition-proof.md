---
title: Make It Transition-Proof
impact: MEDIUM
impactDescription: enables ViewTransition animations by wrapping state updates in startTransition
tags: view-transition, startTransition, animation, react-19
---

## Make It Transition-Proof

When using React 19's `<ViewTransition>`, state updates must go through `startTransition` for animations to work. Without it, the panels just snap with no animation.

**Incorrect (no animation with ViewTransition):**

```tsx
function ThemeSettings() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {showAdvanced ? <AdvancedPanel /> : <SimplePanel />}
      <button onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Simple' : 'Advanced'}
      </button>
    </>
  )
}
```

Wrapping this in `<ViewTransition>` does nothing — the panels snap without animating.

**Correct (startTransition enables the animation):**

```tsx
function ThemeSettings() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {showAdvanced ? <AdvancedPanel /> : <SimplePanel />}
      <button onClick={() =>
        startTransition(() => setShowAdvanced(!showAdvanced))
      }>
        {showAdvanced ? 'Simple' : 'Advanced'}
      </button>
    </>
  )
}
```

`startTransition` marks the state update as a transition, enabling `<ViewTransition>` to animate the change smoothly.
