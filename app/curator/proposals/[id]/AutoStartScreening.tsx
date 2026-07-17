'use client';

import { useEffect } from 'react';
import { startScreeningAction } from '@/app/actions/screening';

export default function AutoStartScreening({ assignmentId }: { assignmentId: number }) {
  useEffect(() => {
    // Fire-and-forget server action
    startScreeningAction(assignmentId).catch(console.error);
  }, [assignmentId]);

  return null;
}
