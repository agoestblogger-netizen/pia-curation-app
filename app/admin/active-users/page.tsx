import { requireRole } from '@/lib/auth/helpers';
import { getActiveUsersAction } from '@/app/actions/active-users';
import ActiveUsersClient from './ActiveUsersClient';

export const metadata = {
  title: 'Monitoring User Aktif - Admin Zone',
};

export default async function AdminActiveUsersPage() {
  await requireRole('admin');

  const res = await getActiveUsersAction();

  return (
    <div className="p-6">
      <ActiveUsersClient
        initialData={{
          activeCount: res.activeCount,
          users: res.users,
          fetchedAt: res.fetchedAt,
        }}
      />
    </div>
  );
}
