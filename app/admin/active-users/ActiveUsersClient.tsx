'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getActiveUsersAction, ActiveUserDTO } from '@/app/actions/active-users';

export default function ActiveUsersClient({
  initialData,
}: {
  initialData: {
    activeCount: number;
    users: ActiveUserDTO[];
    fetchedAt: string;
  };
}) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const fetchLatestData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getActiveUsersAction();
      if (res.success) {
        setData({
          activeCount: res.activeCount,
          users: res.users,
          fetchedAt: res.fetchedAt,
        });
      }
    } catch (err) {
      console.error('Failed to fetch active users:', err);
    } finally {
      setIsLoading(false);
      setCountdown(30);
    }
  }, []);

  // 30-second interval auto refresh
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatestData();
    }, 30000);

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(countdownTimer);
    };
  }, [fetchLatestData]);

  // Helper for formatting relative time
  const formatTimeAgo = (seconds: number | null) => {
    if (seconds === null) return 'Tidak diketahui';
    if (seconds < 10) return 'Baru saja';
    if (seconds < 60) return `${seconds} detik yang lalu`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 1) return `1 menit ${secs > 0 ? `${secs} d` : ''} yang lalu`;
    return `${mins} menit ${secs > 0 ? `${secs} d` : ''} yang lalu`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back to Dashboard */}
      <div>
        <Link
          href="/overview"
          className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors gap-1"
        >
          &larr; Kembali ke Dashboard
        </Link>
      </div>

      {/* Header & Auto-refresh status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span>Monitoring User Aktif</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Real-time (5 Min Threshold)
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Menampilkan daftar pengguna yang sedang mengakses/melakukan aktivitas di aplikasi saat ini.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="text-xs text-gray-400 text-right">
            <div>Auto-refresh dalam: <strong className="text-indigo-600">{countdown}s</strong></div>
            <div className="text-[11px]">Terakhir diupdate: {new Date(data.fetchedAt).toLocaleTimeString('id-ID')}</div>
          </div>
          <button
            onClick={fetchLatestData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Sekarang
          </button>
        </div>
      </div>

      {/* Main Stat Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-6 rounded-2xl shadow-sm border border-indigo-700 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold text-indigo-300 tracking-wider mb-2">
              User Aktif Sekarang
            </div>
            <div className="text-5xl font-extrabold flex items-baseline gap-2">
              <span>{data.activeCount}</span>
              <span className="text-lg font-normal text-indigo-200">user</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-700/60 text-xs text-indigo-200 flex items-center justify-between">
            <span>Status Aktif</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Online
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold text-gray-400 tracking-wider mb-2">
              Batas Toleransi (Threshold)
            </div>
            <div className="text-3xl font-bold text-gray-900">5 Menit</div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
            User dianggap non-aktif jika tidak ada aktivitas selama &gt; 300 detik
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold text-gray-400 tracking-wider mb-2">
              Interval Pembaruan Data
            </div>
            <div className="text-3xl font-bold text-gray-900">30 Detik</div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
            Otomatis memperbarui daftar di bawah tanpa perlu memuat ulang halaman
          </div>
        </div>
      </div>

      {/* User Table List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-base">Daftar Pengguna Aktif</h2>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {data.users.length} pengguna
          </span>
        </div>

        {data.users.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="font-medium text-gray-700">Belum ada user yang aktif dalam 5 menit terakhir</p>
            <p className="text-xs text-gray-400 mt-1">Aktivitas user akan otomatis muncul di sini begitu mereka mengakses sistem.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Pengguna</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role / Peran</th>
                  <th className="px-6 py-3">Terakhir Aktif</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {u.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((role) => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                              role === 'admin'
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : role === 'coordinator'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : role === 'curator'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : role === 'promoter'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : role === 'sponsor'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 text-xs">
                        {formatTimeAgo(u.secondsAgo)}
                      </div>
                      {u.lastActiveAt && (
                        <div className="text-[10px] text-gray-400">
                          Pukul {new Date(u.lastActiveAt).toLocaleTimeString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Aktif
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
