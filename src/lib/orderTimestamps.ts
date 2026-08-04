import { Prisma } from '@prisma/client';

type ColumnCountRow = { total: bigint | number };

type DbClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

const processingStatuses = new Set(['processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem']);

export function isProcessingStatus(status: string) {
  return processingStatuses.has(status);
}

export async function hasColumn(db: DbClient, tableName: string, columnName: string) {
  const rows = await db.$queryRaw<ColumnCountRow[]>`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;

  return Number(rows[0]?.total || 0) > 0;
}

export async function getOrderTimestampCapabilities(db: DbClient, tableName: string) {
  const [pendingAt, processingAt, lastUpdate] = await Promise.all([
    hasColumn(db, tableName, 'pending_at'),
    hasColumn(db, tableName, 'processing_at'),
    hasColumn(db, tableName, 'last_update'),
  ]);

  return { pendingAt, processingAt, lastUpdate };
}

export async function syncOrderTimestampColumns(
  db: DbClient,
  tableName: string,
  orderId: number,
  status: string,
  eventAt: Date = new Date(),
) {
  const capabilities = await getOrderTimestampCapabilities(db, tableName);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (capabilities.pendingAt && status === 'pending') {
    updates.push('pending_at = ?');
    params.push(eventAt);
  }

  if (capabilities.processingAt) {
    if (status === 'pending') {
      updates.push('processing_at = NULL');
    } else if (isProcessingStatus(status)) {
      updates.push('processing_at = COALESCE(processing_at, ?)');
      params.push(eventAt);
    }
  }

  if (capabilities.lastUpdate) {
    updates.push('last_update = ?');
    params.push(eventAt);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(orderId);
  await db.$executeRawUnsafe(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = ?`, ...params);
}
