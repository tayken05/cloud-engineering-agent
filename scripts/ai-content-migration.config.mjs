export const aiContentMigrationConfig = Object.freeze({
  confirmationPhrase: "APPLY AI CONTENT MIGRATION TO NEON MAIN ep-spring-grass-b7iye83x",
  enums: ["ai_generation_kind", "ai_generation_status", "ai_suggestion_status", "ai_verification_status"],
  migrationFile: "drizzle/0005_ai_content_generation.sql",
  migrationSha256: "e112d33cc6f68bd62230e4e8d882a927982da2c8e4b92ea4f7866662a7bb9427",
  migrationTag: "0005_ai_content_generation",
  migrationTimestamp: 1792103597396,
  tables: ["ai_generation_runs", "ai_content_suggestions", "ai_generation_evidence"],
});
