'use server';

import { db } from '@/lib/db';
import { proposals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';

export async function formatProposalFieldAction(
  proposalId: number,
  fieldName: string,
  originalText: string
) {
  // Verifikasi role (siapa saja yang boleh memicu format AI)
  await requireRole(['coordinator', 'curator', 'promoter', 'sponsor', 'regional']);

  if (!originalText || originalText.trim() === '') {
    return { error: 'Teks asli kosong.' };
  }

  // Filter out redundant metadata headers if present in resubmission document
  let cleanedText = originalText
    .replace(/#*\s*Proposal Resubmission\s*-\s*PIA Season \d+/gi, '')
    .replace(/#*\s*Kategori (Business Case|Breakthrough Innovation)/gi, '')
    .replace(/#*\s*Nama Inovator\s*:?\s*[^:\n#]+?\s*(?=\s*(#*\s*Departemen|#*\s*Kantor|#*\s*Anggota|#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .replace(/#*\s*Departemen\s*\/\s*Divisi\s*:?\s*[^:\n#]+?\s*(?=\s*(#*\s*Kantor|#*\s*Anggota|#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .replace(/#*\s*Kantor Wilayah\s*:?\s*[^:\n#]+?\s*(?=\s*(#*\s*Anggota|#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .replace(/#*\s*Anggota Tim Inovasi Anda[^\n:#]*:?\s*[^:\n#]+?(?=\s*(#*\s*Nama Inovasi|#*\s*Sasaran))/gi, '')
    .trim();

  // Preprocess inline bullet characters (•, ●, ▪, ∘, ○) to newlines so AI and parser format them cleanly
  cleanedText = cleanedText
    .replace(/\s*([•●▪])\s*/g, '\n- ')
    .replace(/\s*([∘○])\s*/g, '\n  - ');

  if (!cleanedText) {
    cleanedText = originalText;
  }

  try {
    const prompt = `Anda HANYA bertugas merapikan format teks ini berdasarkan struktur yang SUDAH ADA di teks asli. 

ATURAN KETAT YANG WAJIB DIPATUHI:
1. DILARANG KERAS mengurangi kalimat, meringkas isi, menghilangkan detail, atau mengondensasi informasi apa pun.
2. DILARANG KERAS menambah informasi atau interpretasi baru.
3. DILARANG KERAS mengesampingkan atau mengurai ulang kalimat (parafrase). Pertahankan seluruh isi secara persis.
4. PENOMORAN & BULLET LIST (SANGAT WAJIB & KONSISTEN):
   - Jika terdapat simbol bullet (seperti "•", "●", "▪", "∘", "○") atau penomoran ("1,", "1)", "1.", "a.", "a)") yang menyatu di dalam kalimat/paragraf, WAJIB DIPISAHKAN KE BARIS BARU TERSENDIRI.
   - Ubah simbol "•", "●", "▪" menjadi bullet utama Markdown: "- Poin".
   - Ubah simbol "∘", "○" atau sub-poin menjadi sub-bullet dengan indentasi 3 spasi: "   - Sub poin".
   - Setiap poin penomoran atau bullet WAJIB berada di BARIS BARU tersendiri.
   - DILARANG KERAS menggabungkan penomoran dan bullet sekaligus (misalnya DILARANG "- 1. " atau "* 1. "). Gunakan murni "1. " untuk urutan angka atau "- " untuk bullet.
5. TATA LETAK & PARAGRAF:
   - Gunakan Heading Markdown (## Judul Utama atau ### Sub Judul) untuk setiap bagian/topik utama.
   - Berikan baris kosong (\n\n) di antara setiap paragraf atau section agar tampilan sangat bersih dan rapi.

Teks yang harus Anda rapikan formatnya:

${cleanedText}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('OpenAI Error:', errorText);
      throw new Error('Gagal menghubungi AI service.');
    }

    const data = await res.json();
    const formattedText = data.choices[0]?.message?.content || '';

    if (!formattedText.trim()) {
      return { error: 'Gagal menghasilkan format teks dari AI.' };
    }

    // Ambil data proposal saat ini untuk mendapatkan JSONB yang lama
    const [proposal] = await db
      .select({ formattedTexts: proposals.formattedTexts })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal tidak ditemukan.' };
    }

    const currentFormattedTexts = (proposal.formattedTexts as Record<string, string>) || {};
    const newFormattedTexts = {
      ...currentFormattedTexts,
      [fieldName]: formattedText,
    };

    // Update database
    await db
      .update(proposals)
      .set({
        formattedTexts: newFormattedTexts,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    revalidatePath('/curator/proposals');
    revalidatePath(`/curator/proposals/${proposalId}`);

    return { success: true, data: formattedText };
  } catch (error: any) {
    console.error('Format AI error:', error);
    return { error: error.message || 'Terjadi kesalahan sistem.' };
  }
}
