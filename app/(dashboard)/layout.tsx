import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { regionalFinalPics, regionalFinalJudges } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ClientSidebar from './ClientSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  let regionalAssignments = { isPic: false, isJudge: false };

  if (session && session.roles.includes('regional')) {
    try {
      if (session.roles.includes('admin')) {
        regionalAssignments.isPic = true;
        
        const judgeCheck = await db.select({ id: regionalFinalJudges.userId })
          .from(regionalFinalJudges)
          .where(eq(regionalFinalJudges.userId, session.userId))
          .limit(1);
        regionalAssignments.isJudge = judgeCheck.length > 0;
      } else {
        const picCheck = await db.select({ id: regionalFinalPics.id })
          .from(regionalFinalPics)
          .where(eq(regionalFinalPics.userId, session.userId))
          .limit(1);
        
        const judgeCheck = await db.select({ id: regionalFinalJudges.userId })
          .from(regionalFinalJudges)
          .where(eq(regionalFinalJudges.userId, session.userId))
          .limit(1);
          
        regionalAssignments.isPic = picCheck.length > 0;
        regionalAssignments.isJudge = judgeCheck.length > 0;
      }
    } catch (err) {
      console.error('[DashboardLayout] Failed to query regional assignments:', err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <ClientSidebar session={session} regionalAssignments={regionalAssignments} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
