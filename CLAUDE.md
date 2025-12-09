# Copilot Instructions for video2md

> **Note:** For detailed instructions, see [.github/copilot-instructions.md](.github/copilot-instructions.md)

## Quick Reference

### Always Run Before Committing

```bash
pnpm format      # Format code with Biome
pnpm fix         # Fix linting issues with Biome
pnpm tsc --noEmit # Type check without emitting files
```

### Testing Philosophy

- **DO**: Write tests for code you write (business logic, utilities, components)
- **DON'T**: Write tests that just verify frameworks/libraries work
- **DON'T**: Write tests that duplicate TypeScript's type checking guarantees

### Running Tests

```bash
pnpm test        # Run all tests once
pnpm test:watch  # Run tests in watch mode
```

### Key Technologies

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest with React Testing Library
- **Code Quality**: Biome (linting and formatting)
- **Package Manager**: pnpm

### Development Commands

```bash
pnpm dev         # Start development server
pnpm build       # Build for production
pnpm start       # Start production server
```

## Important Guidelines

1. **Component Organization**: Extract complex inline JSX into named sub-components
2. **File Structure**: Use `@/*` path alias for imports
3. **TypeScript**: Always use strict mode, avoid `any` types
4. **API Routes**: Use Server-Sent Events for streaming responses
5. **Security**: Validate all user inputs, sanitize data before rendering

For comprehensive instructions including API patterns, styling guidelines, and best practices, refer to [.github/copilot-instructions.md](.github/copilot-instructions.md).
