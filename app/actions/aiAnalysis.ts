'use server';

import { db } from '@/lib/db';
import { proposals, proposalAiAnalyses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function generateFgdAiAnalysis(
  proposalId: number,
  otherProposalsContext: { id: number; title: string; summary: string | null }[]
) {
  try {
    const session = await getSession();
    if (!session || (!session.roles.includes('coordinator') && !session.roles.includes('curator'))) {
      return { error: 'Unauthorized' };
    }

    // Check if analysis already exists (prevent duplicate generation)
    const existing = await db
      .select()
      .from(proposalAiAnalyses)
      .where(eq(proposalAiAnalyses.proposalId, proposalId))
      .limit(1);

    if (existing.length > 0) {
      return { data: existing[0] };
    }

    // Fetch the target proposal
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal not found' };
    }

    const otherProposalsText = otherProposalsContext
      .filter(p => p.id !== proposalId)
      .map(p => `- ID ${p.id}: ${p.title} (${p.summary ? p.summary.substring(0, 100) + '...' : 'Tidak ada ringkasan'})`)
      .join('\n');

    const systemPrompt = `Anda adalah asisten AI ahli untuk kurasi inovasi (Pegadaian Innovation Awards).
Tugas Anda adalah membaca detail sebuah PROPOSAL UTAMA dan memberikan analisis terstruktur dalam format JSON.
Format JSON HARUS spesifik seperti ini:
{
  "structuredSummary": {
    "problem": "Masalah yang Diselesaikan (1-2 kalimat)",
    "solution": "Solusi/Mekanisme (1-2 kalimat)",
    "target": "Target/Klaim Terukur (ringkas, fokus pada objektif)"
  },
  "keyClaims": [
    "Klaim angka 1", "Klaim angka 2"
  ],
  "clarificationPoints": [
    "Poin yang butuh klarifikasi 1", "Poin yang butuh klarifikasi 2"
  ],
  "duplicationCheck": "Hasil deteksi duplikasi"
}

ATURAN:
1. "keyClaims" maksimal 4 poin (fokus pada persentase, nominal, efisiensi, target waktu).
2. "clarificationPoints" maksimal 3 poin. Tandai klaim yang terlalu percaya diri (overconfident), tidak realistis, asumsi tanpa data valid, atau 'garansi pasti berhasil 100%'. Buat dalam nada netral/bertanya.
3. "duplicationCheck": Bandingkan PROPOSAL UTAMA dengan DAFTAR PROPOSAL LAIN. Jika ada ide/konsep yang sangat mirip, sebutkan ID dan judul proposal yang mirip serta letak kemiripannya secara ringkas. Jika tidak ada yang mirip, tulis: "Tidak ditemukan potensi duplikasi yang signifikan di sesi ini."`;

    const latarBelakang = proposal.category === 'BI' 
      ? (proposal.biMasalahDiselesaikan || proposal.biAlasanMemilihSasaran || '-') 
      : (proposal.bcMasalahSasaranInovasi || proposal.bcIdentifikasiMasalah || '-');
      
    const tujuanInovasi = proposal.category === 'BI'
      ? (proposal.biInovasiDiusulkan || proposal.biKeunikanPenyelesaian || '-')
      : (proposal.bcDilakukanUntukMenyelesaikanMasalah || proposal.bcAlternatifSolusi || '-');
      
    const dampakBisnis = proposal.category === 'BI'
      ? (proposal.biTargetFinansial || proposal.biTargetNonFinansial || '-')
      : (proposal.bcTargetCapaianFinansial || proposal.bcTargetCapaianNonFinansial || '-');

    const userPrompt = `PROPOSAL UTAMA:
Judul: ${proposal.title}
Latar Belakang: ${latarBelakang}
Tujuan Inovasi: ${tujuanInovasi}
Dampak Bisnis: ${dampakBisnis}
Ringkasan: ${proposal.summary || '-'}

DAFTAR PROPOSAL LAIN DI SESI INI:
${otherProposalsText || 'Tidak ada proposal lain.'}

Berikan analisis JSON untuk PROPOSAL UTAMA.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: 'OPENAI_API_KEY belum dikonfigurasi di environment variables server.' };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI API Error:', err);
      return { error: 'Gagal memproses AI (Error API Eksternal).' };
    }

    const data = await res.json();
    let aiResult;
    try {
      aiResult = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error('JSON Parse Error:', data.choices[0].message.content);
      return { error: 'Format balasan AI tidak valid (Bukan JSON).' };
    }

    // Ensure types and save to DB
    const structuredSummary = aiResult.structuredSummary || { problem: '', solution: '', target: '' };
    const keyClaims = Array.isArray(aiResult.keyClaims) ? aiResult.keyClaims : [];
    const clarificationPoints = Array.isArray(aiResult.clarificationPoints) ? aiResult.clarificationPoints : [];
    const duplicationCheck = typeof aiResult.duplicationCheck === 'string' ? aiResult.duplicationCheck : null;

    const [inserted] = await db.insert(proposalAiAnalyses).values({
      proposalId: proposalId,
      structuredSummary,
      keyClaims,
      clarificationPoints,
      duplicationCheck,
    }).returning();

    return { data: inserted };
  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return { error: 'Terjadi kesalahan internal server.' };
  }
}

export async function generateResubmissionAiAnalysis(proposalId: number) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: 'Unauthorized' };
    }

    // Check if we already have the cache in proposals
    const [proposal] = await db
      .select({
        id: proposals.id,
        resubmitDocumentText: proposals.resubmitDocumentText,
        resubmitAiAnalysis: proposals.resubmitAiAnalysis
      })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal not found' };
    }

    // If analysis already exists, just return it
    if (proposal.resubmitAiAnalysis) {
      return { data: proposal.resubmitAiAnalysis };
    }

    // If there is no text to analyze
    if (!proposal.resubmitDocumentText) {
      return { error: 'Tidak ada teks resubmission untuk dianalisis.' };
    }

    if (proposal.resubmitDocumentText.includes('ERROR: DOKUMEN HASIL SCAN')) {
      return { error: 'Dokumen resubmission merupakan hasil scan, AI tidak dapat membaca teksnya.' };
    }

    const systemPrompt = `Anda adalah asisten AI ahli untuk kurasi inovasi.
Tugas Anda adalah membaca isi DOKUMEN RESUBMISSION dari sebuah proposal dan merangkum informasi pentingnya.
Format JSON HARUS spesifik seperti ini:
{
  "summary": "Rangkuman isi utama dokumen (2-3 kalimat)",
  "keyFindings": ["Temuan/informasi penting 1", "Temuan 2", "Temuan 3"],
  "methodology": "Bagaimana cara kerja/metodologi yang dijelaskan di dokumen (singkat)",
  "dataValidity": "Analisis singkat apakah ada data/bukti pendukung yang kuat di dalam dokumen ini"
}`;

    const userPrompt = `DOKUMEN RESUBMISSION:
${proposal.resubmitDocumentText}

Berikan analisis JSON berdasarkan dokumen di atas.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: 'OPENAI_API_KEY belum dikonfigurasi.' };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI Error:', err);
      return { error: 'Gagal memproses AI (Error API Eksternal).' };
    }

    const data = await res.json();
    let aiResult;
    try {
      aiResult = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return { error: 'Format balasan AI tidak valid (Bukan JSON).' };
    }

    // Save to DB
    await db
      .update(proposals)
      .set({ resubmitAiAnalysis: aiResult })
      .where(eq(proposals.id, proposalId));

    return { data: aiResult };
  } catch (error: any) {
    console.error('Resubmission AI Analysis Error:', error);
    return { error: 'Terjadi kesalahan internal server.' };
  }
}

