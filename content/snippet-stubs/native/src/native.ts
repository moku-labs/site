import { createApp } from "@moku-labs/native";

export const native = createApp({
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp" },
    web: {
      build: "bun run build",
      devCommand: "bun run dev",
      devUrl: "http://localhost:5173",
      dist: "dist"
    },
    system: [{ name: "store" }],
    targets: ["macos", "ios", "android"]
  }
});
