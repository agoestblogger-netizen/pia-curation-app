'use server';

import { db } from '@/lib/db';
import { proposals, fgdAdditionalDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { put } from '@vercel/blob';
import { getDocumentProxy, extractText } from 'unpdf';

export async function uploadFgdAdditionalDocument(formData: FormData) {
  try {
    const session = await getSession();
    if (!session || !session.roles.includes('coordinator')) {
      return { error: 'Unauthorized. Hanya Koordinator yang dapat mengunggah dokumen tambahan.' };
    }

    const proposalIdStr = formData.get('proposalId') as string;
    const file = formData.get('file') as File;

    if (!proposalIdStr || !file) {
      return { error: 'Data tidak lengkap.' };
    }

    const proposalId = parseInt(proposalIdStr, 10);

    if (file.type !== 'application/pdf') {
      return { error: 'Format file tidak didukung. Harap unggah file PDF.' };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { error: 'Ukuran file melebihi batas maksimal 10MB.' };
    }

    // 1. Parse PDF using unpdf
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    let text = '';
    try {
      const pdf = await getDocumentProxy(buffer);
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text.trim();
    } catch (e) {
      console.error('Failed to parse PDF', e);
      return { error: 'Gagal mengekstrak teks dari PDF. File mungkin rusak atau dilindungi password.' };
    }

    if (text.length < 100) {
      return { error: 'Dokumen ini sepertinya hasil scan/gambar, teksnya tidak bisa dibaca otomatis. Coba upload versi PDF yang teksnya bisa di-copy.' };
    }

    // Slice text to prevent token limit (max ~80000 chars)
    const slicedText = text.length > 80000 ? text.substring(0, 80000) + '\n\n[...TEKS DIPOTONG KARENA TERLALU PANJANG...]' : text;

    // 2. Upload to Vercel Blob
    let fileUrl = '';
    try {
      const blob = await put(`proposals/${proposalId}/${file.name}`, file, {
        access: 'public',
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      fileUrl = blob.url;
    } catch (e: any) {
      console.error('Vercel Blob Upload Error:', e);
      // Fallback or error if Vercel Blob isn't configured
      if (e.message?.includes('BLOB_READ_WRITE_TOKEN')) {
        return { error: 'Vercel Blob belum dikonfigurasi (BLOB_READ_WRITE_TOKEN belum ada di environment).' };
      }
      return { error: 'Gagal mengunggah file ke penyimpanan. Pastikan Vercel Blob aktif.' };
    }

    // 3. AI Analysis
    const systemPrompt = `Anda adalah asisten AI ahli untuk kurasi inovasi.
Tugas Anda adalah membaca isi DOKUMEN TAMBAHAN (PDF) dari sebuah proposal dan merangkum informasi pentingnya.
Format JSON HARUS spesifik seperti ini:
{
  "summary": "Rangkuman isi utama dokumen (2-3 kalimat)",
  "keyFindings": ["Temuan/informasi penting 1", "Temuan 2", "Temuan 3"],
  "methodology": "Bagaimana cara kerja/metodologi yang dijelaskan di dokumen (singkat)",
  "dataValidity": "Analisis singkat apakah ada data/bukti pendukung yang kuat di dalam dokumen ini"
}
`;
    
    const userPrompt = `DOKUMEN TAMBAHAN:
${slicedText}

Berikan analisis JSON berdasarkan dokumen di atas.`;

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
      console.error('OpenAI Error', await res.text());
      return { error: 'Gagal memproses AI (Error API Eksternal).' };
    }

    const data = await res.json();
    let aiResult;
    try {
      aiResult = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return { error: 'Format balasan AI tidak valid (Bukan JSON).' };
    }

    // 4. Save to DB
    const [inserted] = await db.insert(fgdAdditionalDocuments)
      .values({
        proposalId,
        fileName: file.name,
        fileUrl,
        aiAnalysis: aiResult,
        uploadedBy: session.userId
      })
      .returning();
      
    let savedRecord = inserted;

    return { data: savedRecord };
  } catch (e: any) {
    console.error('Unhandled error uploadDocument:', e);
    return { error: e.message || 'Terjadi kesalahan internal server.' };
  }
}
