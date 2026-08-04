export const dynamic = 'force-dynamic';

import { POST as postOlahanImportStatus } from '@/app/api/olahan/import-status/route';

export async function POST(request: Request) {
  return postOlahanImportStatus(request);
}
