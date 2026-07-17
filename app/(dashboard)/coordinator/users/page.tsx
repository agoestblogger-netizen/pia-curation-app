import { requireRole } from '@/lib/auth/helpers';
import { getSession } from '@/lib/auth/session';
import { listUsersAction } from '@/app/actions/users';
import UserManagementClient from './UserManagementClient';

export default async function UsersPage() {
  const session = await requireRole('coordinator');
  const users = await listUsersAction();

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Manajemen User</h1>
        <p className="text-gray-500 text-sm">
          Tambah user baru atau nonaktifkan akun yang tidak lagi digunakan.
          Password awal harus disampaikan manual ke user.
        </p>
      </div>

      <UserManagementClient
        users={users.map(u => ({ ...u, createdAt: u.createdAt ?? null }))}
        currentUserId={session.userId}
      />
    </div>
  );
}
