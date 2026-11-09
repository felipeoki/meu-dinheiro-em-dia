import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/atualizar-cdi')({ server: { handlers: {
  POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({ kind: z.literal('daily') }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const { refreshCdi } = await import('@/lib/cdi.server');
    const state = await refreshCdi(true);
    return Response.json(state, { status: state.failed ? 503 : 200 });
  },
} } });