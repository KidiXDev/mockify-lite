# WXT + Vue 3

This template should help get you started developing with Vue 3 in WXT.

## UI setup

Tailwind CSS v4 is configured through the Vite plugin in `wxt.config.ts`.
The popup imports the global theme from `entrypoints/popup/style.css`.

shadcn-vue follows the [manual installation guide](https://shadcn-vue.com/docs/installation/manual),
using WXT's existing `@/` alias for the project root. Add components with:

```sh
bunx shadcn-vue@latest add input
```

Components are generated in `components/ui`. The starter counter uses `Button`.

## Code quality

```sh
bun run lint          # Oxlint checks, including explicit any as an error
bun run lint:fix      # Apply safe lint fixes
bun run format       # Format with Oxfmt
bun run format:check # Check formatting without changing files
bun run type-check   # Vue and TypeScript type checking
```

Oxlint treats correctness issues, unused variables, `debugger`, `var`, loose
equality, and explicit `any` types as errors, and requires `const` where possible.
Generated WXT files and build output are excluded from linting and formatting.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar).
