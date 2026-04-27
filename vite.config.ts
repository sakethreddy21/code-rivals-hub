// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("lucide-react")) {
                return "lucide";
              }
              if (id.includes("recharts")) {
                return "recharts";
              }
              if (id.includes("@radix-ui")) {
                return "radix";
              }
              if (id.includes("@tanstack")) {
                return "tanstack";
              }
              if (id.includes("supabase")) {
                return "supabase";
              }
              if (id.includes("react-dom")) {
                return "react-dom";
              }
              if (id.includes("react/") || id.includes("react-is") || id.includes("scheduler")) {
                return "react-core";
              }
              return "vendor";
            }
          },
        },
      },
    },
  },
});
