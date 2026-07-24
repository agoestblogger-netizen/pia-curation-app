// Server Component — dibaca server side, aman baca env vars tanpa NEXT_PUBLIC_
// VERCEL_ENV otomatis diisi Vercel: "production" | "preview" | "development"
// Untuk npm run dev lokal, pakai NEXT_PUBLIC_APP_ENV dari .env.local

export default function DevEnvBanner() {
  const vercelEnv = process.env.VERCEL_ENV;          // "production" | "preview" | "development" | undefined
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;    // custom var di .env.local: "development"

  const isProduction = vercelEnv === 'production';

  // Sembunyikan banner jika Production
  if (isProduction) return null;

  // Tentukan label environment
  let envLabel = 'DEVELOPMENT';
  let envDetail = 'npm run dev lokal';
  if (vercelEnv === 'preview') {
    envLabel = 'PREVIEW';
    envDetail = 'Vercel Preview Deployment';
  } else if (vercelEnv === 'development') {
    envLabel = 'DEVELOPMENT';
    envDetail = 'Vercel Dev';
  } else if (appEnv === 'development') {
    envLabel = 'DEVELOPMENT';
    envDetail = 'Lokal — Supabase Dev DB';
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#f59e0b',
        color: '#1c1917',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '12px',
        fontWeight: '700',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '0.02em',
        boxShadow: '0 2px 8px rgba(245,158,11,0.4)',
        borderBottom: '2px solid #d97706',
      }}
    >
      <span style={{ fontSize: '14px' }}>⚠️</span>
      <span>MODE {envLabel} / TESTING</span>
      <span style={{ fontWeight: 400, opacity: 0.8 }}>—</span>
      <span style={{ fontWeight: 400 }}>Bukan Data Kompetisi Asli ({envDetail})</span>
      <span
        style={{
          marginLeft: '8px',
          backgroundColor: '#92400e',
          color: '#fef3c7',
          padding: '1px 8px',
          borderRadius: '9999px',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.05em',
        }}
      >
        {envLabel}
      </span>
    </div>
  );
}
