# Diff page

The removed line does not compile; the result does.

```diff lang=ts check
 import { route } from "@moku-labs/web";

-export const home = route(404);
+export const home = route("/");
```

The added line does not compile.

```ts diff check
 import { route } from "@moku-labs/web";

-export const home = route("/");
+export const home = route(404);
```
