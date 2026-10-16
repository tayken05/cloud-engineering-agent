import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { jobsMigrationConfig } from "./jobs-migration.config.mjs";
import { jobDiscoveryMigrationConfig } from "./job-discovery-migration.config.mjs";
import { contentWorkspaceMigrationConfig } from "./content-workspace-migration.config.mjs";
import { aiContentMigrationConfig } from "./ai-content-migration.config.mjs";
import { aiVisualMigrationConfig } from "./ai-visual-migration.config.mjs";
import { intelligentNewsroomMigrationConfig } from "./intelligent-newsroom-migration.config.mjs";

export const approvedMigrationHistory = Object.freeze([
  Object.freeze({
    hash: productionMigrationConfig.migrationSha256,
    tag: productionMigrationConfig.migrationTag,
    timestamp: productionMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: collectionRunsMigrationConfig.migrationSha256,
    tag: collectionRunsMigrationConfig.migrationTag,
    timestamp: collectionRunsMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: jobsMigrationConfig.migrationSha256,
    tag: jobsMigrationConfig.migrationTag,
    timestamp: jobsMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: jobDiscoveryMigrationConfig.migrationSha256,
    tag: jobDiscoveryMigrationConfig.migrationTag,
    timestamp: jobDiscoveryMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: contentWorkspaceMigrationConfig.migrationSha256,
    tag: contentWorkspaceMigrationConfig.migrationTag,
    timestamp: contentWorkspaceMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: aiContentMigrationConfig.migrationSha256,
    tag: aiContentMigrationConfig.migrationTag,
    timestamp: aiContentMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: aiVisualMigrationConfig.migrationSha256,
    tag: aiVisualMigrationConfig.migrationTag,
    timestamp: aiVisualMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: intelligentNewsroomMigrationConfig.migrationSha256,
    tag: intelligentNewsroomMigrationConfig.migrationTag,
    timestamp: intelligentNewsroomMigrationConfig.migrationTimestamp,
  }),
]);

export function migrationHistoryMatches(rows) {
  return Array.isArray(rows) &&
    rows.length === approvedMigrationHistory.length &&
    rows.every((row, index) => (
      row?.hash === approvedMigrationHistory[index].hash &&
      Number(row?.created_at) === approvedMigrationHistory[index].timestamp
    ));
}
