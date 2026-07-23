import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const activeRoleCookie = cookieStore.get(`pia_active_role_${session.userId}`)?.value;

  if (activeRoleCookie && session.roles.includes(activeRoleCookie)) {
    if (activeRoleCookie === 'regional') {
      redirect('/regional-dashboard');
    } else if (activeRoleCookie === 'curator' || activeRoleCookie === 'coordinator' || activeRoleCookie === 'viewer') {
      redirect('/overview');
    } else if (activeRoleCookie === 'promoter') {
      redirect('/promoter');
    } else if (activeRoleCookie === 'sponsor') {
      redirect('/sponsor');
    }
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
