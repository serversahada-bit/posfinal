import { Suspense } from 'react';
import EditOrderForm from './EditOrderForm';

export default function EditOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-500 shadow-sm">
            Memuat pesanan...
          </div>
        </div>
      }
    >
      <EditOrderForm />
    </Suspense>
  );
}
