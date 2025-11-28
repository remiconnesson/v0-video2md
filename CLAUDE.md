always run:
- pnpm format
- pnpm fix
- pnpm tsc --noEmit

testing:
- don't write tests that just verify that the libs/frameworks or js features work... only test code you wrote.
- we have type checking, so no need to write tests that give us the same guarantees the type checker does.
