import { relations } from "drizzle-orm/_relations";
import { sql } from "drizzle-orm";

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { user } from "@/lib/auth-schema";

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "error",
]);

// "chat" = normal conversation turn, "voice" = Generate voice request/result
export const messageKind = pgEnum("message_kind", ["chat", "voice"]);

export const audioSource = pgEnum("audio_source", [
  "listen", // Listen button on an assistant reply
  "generate", // Generate voice mode
  "upload", // reserved for user-uploaded audio later
]);

export const chat = pgTable(
  "chat",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => [
    index("chat_userId_updatedAt_idx").on(table.userId, table.updatedAt),
  ],
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    kind: messageKind("kind").default("chat").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_chatId_createdAt_idx").on(table.chatId, table.createdAt),
  ],
);

export const audioFile = pgTable(
  "audio_file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // nullable so audio can outlive or exist without a message
    messageId: uuid("message_id").references(() => message.id, {
      onDelete: "set null",
    }),
    source: audioSource("source").notNull(),
    storageKey: text("storage_key").notNull(), // path/key in your bucket
    url: text("url"), // public or signed URL if you use one
    mimeType: text("mime_type").default("audio/wav").notNull(),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    voice: text("voice"), // e.g. the Orpheus voice name
    model: text("model"),
    textInput: text("text_input"), // the text that was spoken
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audio_userId_idx").on(table.userId),
    index("audio_messageId_idx").on(table.messageId),
  ],
);

export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, { fields: [chat.userId], references: [user.id] }),
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
  chat: one(chat, { fields: [message.chatId], references: [chat.id] }),
  audioFiles: many(audioFile),
}));

export const audioFileRelations = relations(audioFile, ({ one }) => ({
  user: one(user, { fields: [audioFile.userId], references: [user.id] }),
  message: one(message, {
    fields: [audioFile.messageId],
    references: [message.id],
  }),
}));
