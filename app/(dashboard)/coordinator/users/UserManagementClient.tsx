'use client';

import { useState, useTransition } from 'react';
import { createUserAction, toggleUserStatusAction, updateUserAction, deleteUserAction } from '@/app/actions/users';

type UserRow = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date | null;
};

const ROLE_LABELS: Record<string, string> = {
  coordinator: 'Koordinator',
  curator: 'Kurator',
  promoter: 'Promotor',
  sponsor: 'Sponsor',
};

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'bg-purple-100 text-purple-700',
  curator: 'bg-blue-100 text-blue-700',
  promoter: 'bg-yellow-100 text-yellow-700',
  sponsor: 'bg-green-100 text-green-700',
};

interface Props {
  users: UserRow[];
  currentUserId: number;
}

export default function UserManagementClient({ users: initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState<UserRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleToggle = async (userId: number, currentStatus: boolean) => {
    setTogglingId(userId);
    const result = await toggleUserStatusAction(userId, !currentStatus);
    if (result.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
    }
    setTogglingId(null);
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus user ${userName}? Aksi ini hanya akan me-nonaktifkan akun dan menandainya sebagai terhapus.`)) {
      startTransition(async () => {
        const result = await deleteUserAction(userId);
        if (result.success) {
          setUsers(prev => prev.filter(u => u.id !== userId));
        } else {
          alert(result.error);
        }
      });
    }
  };

  const openAddForm = () => {
    setEditMode(null);
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const openEditForm = (user: UserRow) => {
    setEditMode(user);
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      setFormError(null);
      setFormSuccess(null);

      if (editMode) {
        // Edit User
        formData.append('userId', String(editMode.id));
        const result = await updateUserAction({}, formData);
        
        if (result.error) {
          setFormError(result.error);
        } else {
          const isPasswordReset = formData.get('password') ? ' Password baru telah di-set.' : '';
          setFormSuccess(`✅ Profil user berhasil diperbarui.${isPasswordReset}`);
          setUsers(prev => prev.map(u => {
            if (u.id === editMode.id) {
              return {
                ...u,
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                roles: formData.getAll('roles') as string[],
                isActive: formData.get('isActive') === 'true',
              };
            }
            return u;
          }));
          setTimeout(() => { setShowForm(false); setEditMode(null); }, 1500);
        }
      } else {
        // Create User
        const result = await createUserAction({}, formData);
        if (result.error) {
          setFormError(result.error);
        } else {
          setFormSuccess(`✅ User berhasil ditambahkan (ID: ${result.userId}).`);
          const newUser: UserRow = {
            id: result.userId!,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            roles: formData.getAll('roles') as string[],
            isActive: true,
            createdAt: new Date(),
          };
          setUsers(prev => [...prev, newUser]);
          setTimeout(() => { setShowForm(false); }, 1500);
        }
      }
    });
  };

  return (
    <div>
      {/* Add User Button */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Daftar User</h2>
          <p className="text-sm text-gray-500">{users.length} user terdaftar</p>
        </div>
        <button
          onClick={() => showForm ? setShowForm(false) : openAddForm()}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Tutup Form' : '+ Tambah User'}
        </button>
      </div>

      {/* Add/Edit User Form */}
      {showForm && (
        <div className="mb-8 bg-white p-6 rounded-xl border border-indigo-200 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">{editMode ? 'Edit User' : 'Tambah User Baru'}</h3>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nama</label>
              <input
                name="name"
                defaultValue={editMode?.name ?? ''}
                required
                placeholder="Nama lengkap"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={editMode?.email ?? ''}
                required
                placeholder="email@domain.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Role(s) (Pilih satu atau lebih)</label>
              <div className="flex gap-4">
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <label key={val} className="flex items-center space-x-2 text-sm">
                    <input 
                      type="checkbox" 
                      name="roles" 
                      value={val} 
                      defaultChecked={editMode?.roles?.includes(val)}
                      className="rounded text-indigo-600 focus:ring-indigo-500" 
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {editMode && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Status Akun</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="radio" name="isActive" value="true" defaultChecked={editMode.isActive} className="text-indigo-600 focus:ring-indigo-500" />
                    <span>Aktif</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="radio" name="isActive" value="false" defaultChecked={!editMode.isActive} className="text-indigo-600 focus:ring-indigo-500" />
                    <span>Nonaktif</span>
                  </label>
                </div>
              </div>
            )}

            {editMode && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reset Password (Opsional)
                </label>
                <input
                  name="password"
                  type="password"
                  placeholder="Kosongkan jika tidak diubah"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {!editMode && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password Awal</label>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Min. 8 karakter"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="col-span-2 mt-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? 'Menyimpan...' : (editMode ? 'Simpan Perubahan' : 'Simpan User')}
              </button>
              {!editMode && (
                <p className="text-xs text-gray-400 mt-2">
                  Password ini harus disampaikan manual ke user. Sistem tidak mengirim email.
                </p>
              )}
            </div>
          </form>
        </div>
      )}

      {/* User Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role(s)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dibuat</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-sm text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((r) => (
                      <span key={r} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID') : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${user.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {user.isActive ? '● Aktif' : '● Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => openEditForm(user)}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      title="Edit User"
                    >
                      ✏️ Edit
                    </button>
                    {user.id !== currentUserId ? (
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        title="Hapus (Soft Delete)"
                      >
                        🗑️ Hapus
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300 w-12 text-center">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
