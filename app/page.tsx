import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  if (session.roles.includes('coordinator')) {
    redirect('/overview');
  } else if (session.roles.includes('curator')) {
    redirect('/overview');
  } else if (session.roles.includes('promoter')) {
    redirect('/promoter');
  } else if (session.roles.includes('sponsor')) {
    redirect('/sponsor');
  } else if (session.roles.includes('regional')) {
    redirect('/regional-dashboard');
  } else if (session.roles.includes('viewer')) {
    redirect('/overview');
  } else {
    redirect('/login');
  }
}
