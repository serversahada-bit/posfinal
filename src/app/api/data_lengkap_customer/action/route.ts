export const dynamic = 'force-dynamic';

import { POST as postOlahanAction } from '@/app/api/olahan/action/route';

export async function POST(request: Request) {
  return postOlahanAction(request);
}
