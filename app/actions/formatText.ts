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
  // Hanya Koordinator, Kurator, Promotor, atau Sponsor yang boleh trigger
  await requireRole(['coordinator', 'curator', 'promoter', 'sponsor']);

  if (!originalText || originalText.trim() === '') {
    return { error: 'Teks asli kosong.' };
  }

  try {
    const prompt = `Anda HANYA bertugas merapikan format teks ini berdasarkan struktur yang SUDAH ADA di teks asli. 

ATURAN KETAT YANG WAJIB DIPATUHI:
1. DILARANG KERAS mengurangi kalimat, meringkas isi, menghilangkan detail, atau mengondensasi informasi apa pun.
2. DILARANG KERAS menambah informasi atau interpretasi baru.
3. DILARANG KERAS mengubah kata-kata/kalimat asli (parafrase). Pertahankan seluruh teks asli secara persis 100%.
4. HANYA ubah strukturnya (line breaks & markdown): 
   - Pecah paragraf yang terlalu panjang (wall-of-text) ke dalam paragraf-paragraf yang lebih logis.
   - Tambahkan heading/subheading (## atau ###) JIKA teks asli sudah punya penanda topik yang jelas (misalnya "1. Sistem...", "2. Strategi..."). Jangan mengarang heading baru.
   - Ubah list yang tertanam dalam paragraf (misalnya "A: ..., B: ...") menjadi bullet point yang jelas tanpa mengubah isi kalimat.
   - Bold/highlight istilah teknis utama jika relevan (opsional).

Teks yang harus Anda rapikan formatnya:

${originalText}`;

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
