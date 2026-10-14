import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";

export const approvedMigrationHistory = Object.freeze([
  Object.freeze({
    hash: productionMigrationConfig.migrationSha256,
    timestamp: productionMigrationConfig.migrationTimestamp,
  }),
  Object.freeze({
    hash: collectionRunsMigrationConfig.migrationSha256,
    timestamp: collectionRunsMigrationConfig.migrationTimestamp,
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
