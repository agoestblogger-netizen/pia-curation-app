'use server';

import { db } from '@/lib/db';
import { proposals, proposalAiAnalyses } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { generateFgdAiAnalysis } from './aiAnalysis';

export interface SimilarityResult {
  tingkatKemiripan: 'TINGGI' | 'SEDANG' | 'RENDAH';
  ringkasan: string;
  yangMirip: string[];
  yangBeda: string[];
  catatanTag?: string | null;
}

function buildProposalText(p: any): string {
  const lines: string[] = [
    `Judul: ${p.title}`,
    `Kategori: ${p.category}`,
    `Ringkasan/Deskripsi: ${p.summary || '-'}`,
  ];

  if (p.category === 'BI') {
    lines.push(`Masalah Diselesaikan: ${p.biMasalahDiselesaikan || '-'}`);
    lines.push(`Inovasi Diusulkan: ${p.biInovasiDiusulkan || '-'}`);
    lines.push(`Keunikan Penyelesaian: ${p.biKeunikanPenyelesaian || '-'}`);
    lines.push(`Target Finansial: ${p.biTargetFinansial || '-'}`);
    lines.push(`Target Non-Finansial: ${p.biTargetNonFinansial || '-'}`);
    lines.push(`Sasaran Pengguna: ${p.biSasaranPenggunaInovasi || '-'}`);
  } else {
    // BC / PUSAT / WILAYAH
    lines.push(`Masalah Sasaran Inovasi: ${p.bcMasalahSasaranInovasi || '-'}`);
    lines.push(`Identifikasi Masalah: ${p.bcIdentifikasiMasalah || '-'}`);
    lines.push(`Solusi Yang Dilakukan: ${p.bcDilakukanUntukMenyelesaikanMasalah || '-'}`);
    lines.push(`Alternatif Solusi: ${p.bcAlternatifSolusi || '-'}`);
    lines.push(`Detil Cara Kerja: ${p.bcDetilCaraKerja || '-'}`);
    lines.push(`Target Capaian Finansial: ${p.bcTargetCapaianFinansial || '-'}`);
    lines.push(`Target Capaian Non-Finansial: ${p.bcTargetCapaianNonFinansial || '-'}`);
  }

  return lines.join('\n');
}

export async function compareProposalsAction(
  proposalAId: number,
  proposalBId: number
): Promise<{ data?: SimilarityResult; error?: string }> {
  const session = await getSession();
  if (
    !session ||
    (!session.roles.includes('curator') && !session.roles.includes('coordinator') && !session.roles.includes('admin'))
  ) {
    return { error: 'Unauthorized' };
  }

  if (proposalAId === proposalBId) {
    return { error: 'Tidak bisa membandingkan proposal dengan dirinya sendiri.' };
  }

  // Fetch both proposals
  const [proposalA] = await db.select().from(proposals).where(eq(proposals.id, proposalAId)).limit(1);
  const [proposalB] = await db.select().from(proposals).where(eq(proposals.id, proposalBId)).limit(1);

  if (!proposalA || !proposalB) {
    return { error: 'Salah satu atau kedua proposal tidak ditemukan.' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: 'OPENAI_API_KEY belum dikonfigurasi di server.' };
  }

  const textA = buildProposalText(proposalA);
  const textB = buildProposalText(proposalB);

  const tagsA = [proposalA.tagging, proposalA.tagging2].filter(Boolean).join(', ') || '-';
  const tagsB = [proposalB.tagging, proposalB.tagging2].filter(Boolean).join(', ') || '-';
  const sharedTags = [proposalA.tagging, proposalA.tagging2]
    .filter(Boolean)
    .filter((t) => t === proposalB.tagging || t === proposalB.tagging2);
  const sameTagNote =
    sharedTags.length > 0
      ? `Kedua proposal sama-sama menjawab brief sub-tema "${sharedTags.join(', ')}" — kemiripan di level masalah/tema adalah WAJAR dan TIDAK BOLEH dihitung sebagai indikasi duplikasi.`
      : '';

  const systemPrompt = `Anda adalah asisten AI ahli kurasi inovasi (Pegadaian Innovation Awards - PIA).
Tugas Anda: menganalisis kemiripan antara DUA proposal inovasi untuk mendeteksi potensi DUPLIKASI yang sesungguhnya.

=== LAPIS 1 — INSTRUKSI UTAMA ===
Abaikan kesamaan yang berasal dari syarat/ketentuan umum kompetisi yang wajib dipenuhi semua peserta.
Fokus HANYA pada kemiripan spesifik terkait: mekanisme/cara kerja solusi, detail implementasi, atau pendekatan konkret.
BUKAN pada kesamaan tema/masalah yang memang sudah ditentukan oleh brief kompetisi.

=== LAPIS 2 — HAL YANG WAJIB DIABAIKAN SEBAGAI KEMIRIPAN ===
Secara khusus, JANGAN anggap hal berikut sebagai kemiripan:
(a) Sama-sama memanfaatkan infrastruktur Pegadaian yang sudah ada
(b) Sama-sama menyebut CRM sebagai tools (CRM adalah alat, bukan inovasi itu sendiri)
(c) Sama-sama merujuk RJPP sebagai acuan strategi
(d) Sama-sama bukan berbentuk dashboard semata
(e) Sama-sama menyasar nasabah/pengguna Pegadaian secara umum

=== LAPIS 3 — KONTEKS TAG SUB-TEMA ===
Setiap proposal punya tag sub-tema yang menentukan pertanyaan brief yang harus dijawab.
Jika kedua proposal memiliki tag yang sama, kemiripan di level masalah/tema adalah WAJAR — tidak boleh dihitung sebagai duplikasi.
Penilaian kemiripan HANYA pada: mekanisme solusi, detail teknis, dan pendekatan implementasi yang konkret.

=== FEW-SHOT EXAMPLES (KALIBRASI) ===

Contoh 1 — Kemiripan WAJAR → hasil RENDAH:
- Tag: Keduanya "Brand Awareness G24"
- Proposal A: kampanye influencer lokal + reward member-get-member
- Proposal B: integrasi checkout emas di e-commerce + konten edukasi short-video
→ Tingkat Kemiripan: RENDAH (sama tag, tapi mekanisme solusi berbeda total)

Contoh 2 — Kemiripan NYATA → hasil TINGGI:
- Tag: Keduanya "Efisiensi Proses Internal"
- Proposal A: sistem OCR validasi KTP+sertifikat gadai, waktu 15→3 menit, terintegrasi sistem KIOSK cabang
- Proposal B: aplikasi pemindai OCR validasi identitas+sertifikat nasabah gadai, waktu 15→3-5 menit, terhubung sistem kios cabang
→ Tingkat Kemiripan: TINGGI (mekanisme OCR, objek validasi, angka waktu, dan sistem integrasi semua nyaris identik)

=== FORMAT OUTPUT JSON ===
Berikan hasil dalam format JSON TEPAT seperti ini:
{
  "tingkatKemiripan": "TINGGI" | "SEDANG" | "RENDAH",
  "ringkasan": "1-2 kalimat menjelaskan kenapa mirip atau berbeda dari sisi MEKANISME",
  "yangMirip": ["poin mekanisme/detail konkret (bukan tema/tag)"],
  "yangBeda": ["poin spesifik"],
  "catatanTag": "string atau null — isi HANYA jika kedua proposal share tag yang sama, jelaskan bahwa kesamaan tema sudah diperhitungkan dan tidak memengaruhi penilaian"
}

PANDUAN TINGKAT:
- TINGGI: Mekanisme inti, detail implementasi, dan/atau angka target sangat serupa — berpotensi duplikasi nyata
- SEDANG: Ada kesamaan mekanisme yang signifikan tapi perbedaan implementasi cukup berarti
- RENDAH: Mekanisme dan pendekatan implementasinya berbeda secara fundamental
- "yangMirip" dan "yangBeda": masing-masing 1-4 poin, SPESIFIK dan konkret, BUKAN tentang tema/tag umum`;

  const userPrompt = `PROPOSAL A:
Tag Sub-Tema: ${tagsA}
${textA}

---

PROPOSAL B:
Tag Sub-Tema: ${tagsB}
${textB}

---

${sameTagNote ? `CATATAN TAG: ${sameTagNote}\n\n` : ''}Analisis kemiripan MEKANISME SOLUSI kedua proposal di atas (bukan kemiripan tema/tag).`;


  try {
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
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI API Error:', err);
      if (res.status === 429) return { error: 'Kuota API habis atau rate limit tercapai. Coba lagi beberapa saat.' };
      if (res.status === 401) return { error: 'API Key tidak valid. Hubungi Administrator.' };
      return { error: `Gagal memproses AI (HTTP ${res.status}). Coba lagi.` };
    }

    const data = await res.json();
    let result: SimilarityResult;
    try {
      result = JSON.parse(data.choices[0].message.content);
    } catch {
      return { error: 'Format balasan AI tidak valid. Coba lagi.' };
    }

    // Validate shape
    if (!result.tingkatKemiripan || !result.ringkasan || !Array.isArray(result.yangMirip) || !Array.isArray(result.yangBeda)) {
      return { error: 'Balasan AI tidak lengkap. Coba lagi.' };
    }

    return { data: result };
  } catch (err: any) {
    console.error('Compare proposals error:', err);
    if (err?.cause?.code === 'ECONNRESET' || err?.cause?.code === 'ETIMEDOUT') {
      return { error: 'Koneksi ke server AI timeout. Coba lagi.' };
    }
    return { error: 'Terjadi kesalahan saat menghubungi AI. Coba lagi.' };
  }
}

export async function searchProposalsByCategory(
  category: string,
  excludeId: number,
  competitionId: number,
  query?: string
): Promise<{ id: number; title: string; nomorUrut: number | null }[]> {
  const session = await getSession();
  if (
    !session ||
    (!session.roles.includes('curator') && !session.roles.includes('coordinator') && !session.roles.includes('admin'))
  ) {
    return [];
  }

  const rows = await db
    .select({ id: proposals.id, title: proposals.title, nomorUrut: proposals.nomorUrut })
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.category, category),
        ne(proposals.id, excludeId)
      )
    );

  if (query && query.trim()) {
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        String(r.nomorUrut || '').includes(q)
    );
  }

  return rows;
}

export interface SideBySideProposal {
  id: number;
  title: string;
  category: string;
  summary: string | null;
  aiCidaTotal: number | null;
  aiCidaSolvability: number | null;
  aiCidaDesirability: number | null;
  aiCidaViability: number | null;
  aiCidaFeasibility: number | null;
  aiCidaProblemUrgency: number | null;
  aiCidaUniqueness: number | null;
  nomorUrut: number | null;
  aiAnalysis: {
    structuredSummary?: { problem?: string; solution?: string; target?: string };
    keyClaims?: string[];
    clarificationPoints?: string[];
  } | null;
}

export async function getProposalSideBySideData(
  proposalAId: number,
  proposalBId: number
): Promise<{ a?: SideBySideProposal; b?: SideBySideProposal; error?: string }> {
  const session = await getSession();
  if (
    !session ||
    (!session.roles.includes('curator') && !session.roles.includes('coordinator') && !session.roles.includes('admin'))
  ) {
    return { error: 'Unauthorized' };
  }

  const fetchOne = async (id: number): Promise<SideBySideProposal | undefined> => {
    const [proposal] = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        category: proposals.category,
        summary: proposals.summary,
        aiCidaTotal: proposals.aiCidaTotal,
        aiCidaSolvability: proposals.aiCidaSolvability,
        aiCidaDesirability: proposals.aiCidaDesirability,
        aiCidaViability: proposals.aiCidaViability,
        aiCidaFeasibility: proposals.aiCidaFeasibility,
        aiCidaProblemUrgency: proposals.aiCidaProblemUrgency,
        aiCidaUniqueness: proposals.aiCidaUniqueness,
        nomorUrut: proposals.nomorUrut,
      })
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);

    if (!proposal) return undefined;

    const [analysis] = await db
      .select({
        structuredSummary: proposalAiAnalyses.structuredSummary,
        keyClaims: proposalAiAnalyses.keyClaims,
        clarificationPoints: proposalAiAnalyses.clarificationPoints,
      })
      .from(proposalAiAnalyses)
      .where(eq(proposalAiAnalyses.proposalId, id))
      .limit(1);

    return {
      ...proposal,
      aiAnalysis: analysis
        ? {
            structuredSummary: analysis.structuredSummary as any,
            keyClaims: analysis.keyClaims as string[],
            clarificationPoints: analysis.clarificationPoints as string[],
          }
        : null,
    };
  };

  const [a, b] = await Promise.all([fetchOne(proposalAId), fetchOne(proposalBId)]);
  return { a, b };
}

/**
 * Generate AI analysis for a single proposal (standalone, not FGD context).
 * Reuses generateFgdAiAnalysis which handles cache-check + DB write internally.
 * Returns structured summary or error.
 */
export async function generateSingleProposalAnalysis(proposalId: number): Promise<{
  data?: {
    structuredSummary: { problem?: string; solution?: string; target?: string };
    keyClaims: string[];
    clarificationPoints: string[];
  };
  error?: string;
}> {
  // generateFgdAiAnalysis handles auth, cache check, DB write, and GPT call
  const result = await generateFgdAiAnalysis(proposalId, []);

  if (result.error) return { error: result.error };
  if (!result.data) return { error: 'Tidak ada data yang dikembalikan.' };

  const d = result.data as any;
  return {
    data: {
      structuredSummary: d.structuredSummary || {},
      keyClaims: Array.isArray(d.keyClaims) ? d.keyClaims : [],
      clarificationPoints: Array.isArray(d.clarificationPoints) ? d.clarificationPoints : [],
    },
  };
}
