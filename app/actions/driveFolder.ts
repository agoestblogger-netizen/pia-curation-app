'use server';

export type DriveFolderFile = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  isFolder?: boolean;
};

export type DriveFolderResult = {
  folderId: string;
  folderTitle: string;
  folderUrl: string;
  files: DriveFolderFile[];
  isFallback: boolean;
  errorMessage?: string;
};

// In-memory server cache for folder files list
const folderFilesCache = new Map<string, { timestamp: number; data: DriveFolderResult }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour revalidate cache

export async function getGoogleDriveFolderFilesAction(folderUrl: string, folderTitle: string): Promise<DriveFolderResult> {
  const fallbackResult: DriveFolderResult = {
    folderId: '',
    folderTitle,
    folderUrl,
    files: [],
    isFallback: true,
  };

  if (!folderUrl) return fallbackResult;

  // Extract Folder ID from Google Drive URL
  const folderMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]{20,50})/i);
  if (!folderMatch || !folderMatch[1]) {
    return fallbackResult;
  }

  const folderId = folderMatch[1];
  fallbackResult.folderId = folderId;

  // Return cached result if fresh (< 1 hour)
  const cached = folderFilesCache.get(folderId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    console.warn('[Drive Folder Action] GOOGLE_DRIVE_API_KEY is not set. Using fallback callout banner.');
    return fallbackResult;
  }

  try {
    const query = `'${folderId}' in parents and trashed = false`;
    const fields = 'files(id, name, mimeType, thumbnailLink, webContentLink)';
    const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&key=${apiKey}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const res = await fetch(apiUrl, { next: { revalidate: 3600 } });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn(`[Drive Folder Action] API returned HTTP ${res.status} for folder ${folderId}:`, errData.error?.message || 'File not found / restricted.');
      folderFilesCache.set(folderId, { timestamp: Date.now(), data: fallbackResult });
      return fallbackResult;
    }

    const json = await res.json();
    const rawFiles = json.files || [];

    if (rawFiles.length === 0) {
      folderFilesCache.set(folderId, { timestamp: Date.now(), data: fallbackResult });
      return fallbackResult;
    }

    const files: DriveFolderFile[] = rawFiles.map((f: any) => {
      const isImg = f.mimeType?.startsWith('image/');
      const isPdf = f.mimeType === 'application/pdf';
      const isSubFolder = f.mimeType === 'application/vnd.google-apps.folder';

      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        isFolder: isSubFolder,
        thumbnailUrl: isImg
          ? `https://lh3.googleusercontent.com/d/${f.id}`
          : (f.thumbnailLink || ''),
        previewUrl: isSubFolder
          ? `https://drive.google.com/drive/folders/${f.id}`
          : isPdf
          ? `https://drive.google.com/file/d/${f.id}/preview`
          : `https://drive.google.com/file/d/${f.id}/view`,
        downloadUrl: f.webContentLink || `https://drive.google.com/file/d/${f.id}/view`,
      };
    });

    const successResult: DriveFolderResult = {
      folderId,
      folderTitle,
      folderUrl,
      files,
      isFallback: false,
    };

    folderFilesCache.set(folderId, { timestamp: Date.now(), data: successResult });
    return successResult;

  } catch (err: any) {
    console.error(`[Drive Folder Action] Exception fetching folder ${folderId}:`, err.message || err);
    return fallbackResult;
  }
}
