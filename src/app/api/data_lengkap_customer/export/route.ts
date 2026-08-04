export const dynamic = 'force-dynamic';

import { POST as postOlahanExport } from '@/app/api/olahan/export/route';

export async function POST(request: Request) {
  return postOlahanExport(request);
}
