import type { Prisma } from '@prisma/client';

type AddressSnapshotInput = {
  customerId: number;
  receiverName: string;
  whatsappNumber?: string | null;
  address: string;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  customerAddressId?: number | null;
};

export async function upsertCustomerAddressSnapshot(
  tx: Prisma.TransactionClient,
  input: AddressSnapshotInput,
) {
  const existingDefault = await tx.customer_addresses.findFirst({
    where: {
      customer_id: input.customerId,
      is_default: true,
    },
    select: {
      id: true,
    },
  });

  const data = {
    customer_id: input.customerId,
    receiver_name: input.receiverName,
    whatsapp_number: input.whatsappNumber || null,
    address: input.address,
    district: input.district || null,
    city: input.city || null,
    province: input.province || null,
    is_default: !existingDefault,
  };

  if (input.customerAddressId) {
    return tx.customer_addresses.update({
      where: { id: input.customerAddressId },
      data,
      select: { id: true },
    });
  }

  return tx.customer_addresses.create({
    data,
    select: { id: true },
  });
}
