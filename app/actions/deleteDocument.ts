'use server';

import { db } from '@/lib/db';
import { fgdAdditionalDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { del } from '@vercel/blob';

export async function deleteFgdAdditionalDocument(documentId: number) {
  try {
    const session = await getSession();
    if (!session || !session.roles.includes('coordinator')) {
      return { error: 'Unauthorized. Hanya Koordinator yang dapat menghapus dokumen tambahan.' };
    }

    const doc = await db.select().from(fgdAdditionalDocuments).where(eq(fgdAdditionalDocuments.id, documentId)).limit(1);
    
    if (doc.length === 0) {
      return { error: 'Dokumen tidak ditemukan.' };
    }

    // Attempt to delete from Vercel Blob
    try {
      await del(doc[0].fileUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (blobErr) {
      console.error('Failed to delete blob from vercel, ignoring:', blobErr);
    }

    await db.delete(fgdAdditionalDocuments).where(eq(fgdAdditionalDocuments.id, documentId));

    return { success: true };
  } catch (e: any) {
    console.error('Unhandled error deleteFgdAdditionalDocument:', e);
    return { error: e.message || 'Terjadi kesalahan internal server.' };
  }
}
