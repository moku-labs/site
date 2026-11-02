# Bad page

```ts check
import { route } from "@moku-labs/web";

export const about = route("/about/");
```

```ts check
import { renderRoute } from "@moku-labs/web";

renderRoute("/");
```

A compiler error with a multi-line explanation:

```ts check
export const port = { value: 1 } as { value: string };
```
