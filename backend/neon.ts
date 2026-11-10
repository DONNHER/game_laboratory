import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    realtime: {
      allowedOrigins: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ],
    },
  },
  auth: true,
  buckets: {
    assets: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
