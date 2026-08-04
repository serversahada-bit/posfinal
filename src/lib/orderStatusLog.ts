import { Prisma } from '@prisma/client';

type ActivityLogClient = {
  activity_logs: {
    create(args: Prisma.activity_logsCreateArgs): Promise<unknown>;
  };
};

type StatusLogPayload = {
  userId: number | null | undefined;
  orderCode: string;
  source: string;
  toStatus: string;
  fromStatus?: string | null;
  ipAddress?: string | null;
  reason?: string;
};

export async function logOrderStatusChange(
  db: ActivityLogClient,
  { userId, orderCode, source, toStatus, fromStatus = null, ipAddress = null, reason }: StatusLogPayload,
) {
  if (!userId || !orderCode || !toStatus) {
    return;
  }

  const detailParts = [
    `Order: ${orderCode}`,
    `Source: ${source}`,
    fromStatus ? `Dari: ${fromStatus}` : null,
    `Ke: ${toStatus}`,
    reason || null,
  ].filter(Boolean);

  await db.activity_logs.create({
    data: {
      user_id: userId,
      action: 'Update Status Pesanan',
      target: 'Pesanan',
      details: detailParts.join(' | '),
      ip_address: ipAddress,
    },
  });
}

export async function logOrderCreated(
  db: ActivityLogClient,
  { userId, orderCode, source, toStatus, ipAddress = null, reason }: Omit<StatusLogPayload, 'fromStatus'>,
) {
  if (!userId || !orderCode || !toStatus) {
    return;
  }

  const detailParts = [
    `Order: ${orderCode}`,
    `Source: ${source}`,
    `Status Awal: ${toStatus}`,
    reason || 'Pesanan dibuat',
  ].filter(Boolean);

  await db.activity_logs.create({
    data: {
      user_id: userId,
      action: 'Create Pesanan',
      target: 'Pesanan',
      details: detailParts.join(' | '),
      ip_address: ipAddress,
    },
  });
}
