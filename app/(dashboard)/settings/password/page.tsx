'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/app/actions/auth';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, {});

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href=".." className="text-gray-400 hover:text-gray-600 transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Ganti Password</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {state?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            ✅ Password berhasil diubah.
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password Lama
            </label>
            <input
              type="password"
              name="oldPassword"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password Baru
            </label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
