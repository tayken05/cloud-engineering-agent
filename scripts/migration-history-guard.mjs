import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { jobsMigrationConfig } from "./jobs-migration.config.mjs";
import { jobDiscoveryMigrationConfig } from "./job-discovery-migration.config.mjs";

export const approvedMigrationHistory = Object.freeze([
  Object.freeze({
    hash: productionMigrationConfig.migrationSha256,
    timestamp: productionMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: collectionRunsMigrationConfig.migrationSha256,
    timestamp: collectionRunsMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: jobsMigrationConfig.migrationSha256,
    timestamp: jobsMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: jobDiscoveryMigrationConfig.migrationSha256,
    timestamp: jobDiscoveryMigrationConfig.migrationTimestamp,
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
