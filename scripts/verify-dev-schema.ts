import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const devUrl = process.env.DEV_DATABASE_URL;
const prodUrl = process.env.DATABASE_URL;

async function verify() {
  if (!devUrl) {
    console.error('❌ ERROR: DEV_DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  console.log('🔍 Verifikasi Skema Database Supabase Dev...\n');
  const sqlDev = postgres(devUrl, { max: 1 });

  try {
    const devTables = await sqlDev`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`✅ Supabase Dev Database - Total Tabel: ${devTables.length}`);
    console.log('----------------------------------------');
    devTables.forEach((t, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${t.table_name}`);
    });
    console.log('----------------------------------------\n');

    if (prodUrl) {
      const sqlProd = postgres(prodUrl, { max: 1 });
      try {
        const prodTables = await sqlProd`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `;
        
        console.log(`📊 Perbandingan dengan Production (Total: ${prodTables.length} tabel):`);
        const devNames = new Set(devTables.map((t: any) => t.table_name));
        const prodNames = new Set(prodTables.map((t: any) => t.table_name));
        
        const missingInDev = [...prodNames].filter(x => !devNames.has(x));
        const extraInDev = [...devNames].filter(x => !prodNames.has(x));

        if (missingInDev.length === 0 && extraInDev.length === 0) {
          console.log('🎉 Sempurna! Struktur tabel Supabase Dev 100% IDENTIK dengan Production.');
        } else {
          if (missingInDev.length > 0) console.log('⚠️ Belum ada di Dev:', missingInDev);
          if (extraInDev.length > 0) console.log('⚠️ Tambahan di Dev:', extraInDev);
        }
      } finally {
        await sqlProd.end();
      }
    }
  } catch (err) {
    console.error('❌ Gagal membaca skema Dev:', err);
  } finally {
    await sqlDev.end();
  }
}

verify();
