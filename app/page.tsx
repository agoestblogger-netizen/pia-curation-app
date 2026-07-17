import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  if (session.roles.includes('coordinator')) {
    redirect('/coordinator');
  } else if (session.roles.includes('curator')) {
    redirect('/curator');
  } else if (session.roles.includes('promoter')) {
    redirect('/promoter');
  } else if (session.roles.includes('sponsor')) {
    redirect('/sponsor');
  } else {
    redirect('/login');
  }
}
