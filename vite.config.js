import { defineConfig } from "vite"

// The build time is baked into the site, so you can tell which build you are looking at.
export default defineConfig({
  define: { __BUILT_AT__: JSON.stringify(new Date().toISOString()) },
})
