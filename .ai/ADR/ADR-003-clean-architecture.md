# ADR-003: Clean Architecture with Feature-Based Modules

**Status:** Accepted  
**Date:** 2026-07-01  
**Author:** TokenFlow AI Team  

---

## Context

A flat `src/` folder with intermingled concerns makes it hard to:
- Test business logic without VS Code APIs
- Add a second provider without touching existing code
- Defer features (router, sidebar, AST) without leaving dead code in the critical path

## Decision

Adopt a layered Clean Architecture with feature-based modules:

```
src/
 ├── core/
 │     ├── domain/         ← Pure TypeScript. No VS Code, no Anthropic. Entities + interfaces.
 │     ├── application/    ← Use cases + port interfaces. Depends only on domain.
 │     └── infrastructure/ ← (empty v1; DB adapters, cache adapters go here in v2+)
 │
 ├── features/             ← Feature modules. Implement core ports. Can use VS Code APIs.
 │     ├── workspace/
 │     ├── context/
 │     ├── optimizer/
 │     ├── tokenMonitor/
 │     ├── providers/
 │     ├── storage/
 │     └── statusBar/
 │
 └── shared/               ← Cross-cutting. Logger, errors, constants, types.
```

**Dependency direction:**
```
features → application → domain
features → shared
domain → nothing external
```

## Rationale

- Domain layer (`IProvider`, entities) can be unit tested with zero mocking.
- Adding a second provider = new file in `features/providers/`, zero changes to core.
- Deferred features (router, sidebar) have a clear home when they're built.
- Aligns with SOLID: each module has one reason to change.

## Consequences

- Slightly more folders than a flat structure, but each has an obvious purpose.
- No circular dependencies enforced by ESLint `import/no-cycle`.
- File size limit: 300 lines as a smell detector, not a hard ceiling.
