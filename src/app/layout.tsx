import type { Metadata } from "next";
import "./globals.css";
import { ProductProvider } from "@/contexts/ProductContext";
import { OrderProvider } from "@/contexts/OrderContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Point Of Sale Sahada",
  description: "Aplikasi kasir modern Point Of Sale Sahada — kelola transaksi, produk, dan laporan penjualan dengan mudah. Terhubung ke database db_sahada_order.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          <ProductProvider>
            <OrderProvider>
              <AppShell>
                {children}
              </AppShell>
            </OrderProvider>
          </ProductProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
