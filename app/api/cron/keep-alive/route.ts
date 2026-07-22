import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { competitions } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Optional Vercel Cron Secret verification
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret' },
        { status: 401 }
      );
    }

    // Execute lightweight read query to keep Supabase DB active
    const startTime = Date.now();
    const result = await db.select({ id: competitions.id }).from(competitions).limit(1);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      message: 'Supabase keep-alive query executed successfully',
      activeCompetitionId: result[0]?.id ?? null,
    });
  } catch (error: any) {
    console.error('Supabase Keep-Alive Cron Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Database query failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
