# Good page

A complete example with `check`:

```tsx file="src/routes.tsx" check
import { route } from "@moku-labs/web";

export const home = route("/").render(() => <h1>Home</h1>); // [!note] A route renders a page.
```

A sketch without `check` is not compiled, even though it does not type-check:

```ts
const port: number = "4173";
```
