import { defineConfig } from "drizzle-kit";

export default defineConfig({
schema: ["./lib/auth-schema.ts", "./db/chat-schema.ts"],
  out: "./migrations",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
