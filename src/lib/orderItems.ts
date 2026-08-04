import { Prisma } from '@prisma/client';

type TxLike = Prisma.TransactionClient;

export type ResolvedBundleComponent = {
  productId: number;
  productName: string;
  weightGram: number;
  qtyPerBundle: number;
};

export type ResolvedOrderItem =
  | {
      kind: 'product';
      id: number;
      name: string;
      weightGram: number;
    }
  | {
      kind: 'gift';
      id: number;
      name: string;
      weightGram: number;
    }
  | {
      kind: 'bundle';
      id: number;
      name: string;
      components: ResolvedBundleComponent[];
    };

type ResolveOrderItemInput = {
  itemId: number;
  isGift: boolean;
  isBundle: boolean;
};

export async function resolveOrderItem(tx: TxLike, input: ResolveOrderItemInput): Promise<ResolvedOrderItem> {
  const { itemId, isGift, isBundle } = input;

  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error('Produk yang dipilih tidak valid. Silakan muat ulang halaman lalu pilih ulang item.');
  }

  if (isGift) {
    const gift = await tx.gifts.findUnique({
      where: { id: itemId },
      select: { id: true, gift_name: true, weight_gram: true },
    });

    if (!gift) {
      throw new Error(`Hadiah dengan ID ${itemId} tidak ditemukan atau sudah dihapus.`);
    }

    return {
      kind: 'gift',
      id: gift.id,
      name: gift.gift_name,
      weightGram: gift.weight_gram || 0,
    };
  }

  if (isBundle) {
    const bundle = await tx.product_bundles.findUnique({
      where: { id: itemId },
      include: {
        product_bundle_items: {
          include: {
            products: {
              select: {
                id: true,
                product_name: true,
                weight_gram: true,
              },
            },
          },
        },
      },
    });

    if (!bundle) {
      throw new Error(`Bundling dengan ID ${itemId} tidak ditemukan atau sudah dihapus.`);
    }

    if (!bundle.product_bundle_items.length) {
      throw new Error(`Bundling "${bundle.bundle_name}" belum memiliki komponen produk.`);
    }

    const brokenComponent = bundle.product_bundle_items.find((item) => !item.products);
    if (brokenComponent) {
      throw new Error(`Bundling "${bundle.bundle_name}" memiliki produk yang sudah tidak valid. Periksa data bundling terlebih dahulu.`);
    }

    return {
      kind: 'bundle',
      id: bundle.id,
      name: bundle.bundle_name,
      components: bundle.product_bundle_items.map((item) => ({
        productId: item.product_id,
        productName: item.products!.product_name,
        weightGram: item.products!.weight_gram || 0,
        qtyPerBundle: item.qty,
      })),
    };
  }

  const product = await tx.products.findUnique({
    where: { id: itemId },
    select: { id: true, product_name: true, weight_gram: true },
  });

  if (!product) {
    throw new Error(`Produk dengan ID ${itemId} tidak ditemukan atau sudah dihapus.`);
  }

  return {
    kind: 'product',
    id: product.id,
    name: product.product_name,
    weightGram: product.weight_gram || 0,
  };
}
