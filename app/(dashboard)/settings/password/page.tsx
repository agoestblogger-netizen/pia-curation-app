'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/app/actions/auth';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, {});

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href=".." className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
            ← Kembali
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Ganti Password</h1>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 mb-6 text-sm flex items-start gap-3">
        <span className="text-xl shrink-0">🔒</span>
        <div>
          <div className="font-bold mb-1">Ganti Password Wajib</div>
          <p className="text-amber-800 text-xs leading-relaxed">
            Demi keamanan akun Anda, password default (<code className="font-mono font-semibold">gadai123</code>) harus diganti sebelum melanjutkan ke aplikasi.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {state?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm space-y-3">
            <div className="font-bold flex items-center gap-2 text-emerald-800">
              <span className="text-lg">✅</span> Password Berhasil Diubah!
            </div>
            <p className="text-xs text-emerald-700">
              Password baru Anda telah disimpan dan akun Anda sudah sepenuhnya aktif.
            </p>
            <div className="pt-2">
              <Link
                href="/regional-dashboard"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors shadow-xs"
              >
                Lanjut ke Dashboard Regional →
              </Link>
            </div>
          </div>
        )}

        {!state?.success && (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Password Lama
              </label>
              <input
                type="password"
                name="oldPassword"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Password Baru (Minimal 8 Karakter)
              </label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs text-sm"
              >
                {isPending ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
