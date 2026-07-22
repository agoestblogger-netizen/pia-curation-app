import { getSession } from '@/lib/auth/session';

export default async function ForbiddenPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">403</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Akses Ditolak (Forbidden)</h2>
        <p className="text-gray-500 mb-6">
          Anda tidak memiliki izin (role) yang sesuai untuk mengakses halaman ini.
        </p>
        <a href="/" className="inline-block px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">
          Kembali ke Halaman Utama
        </a>
      </div>
    </div>
  );
}
