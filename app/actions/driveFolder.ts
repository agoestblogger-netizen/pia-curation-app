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
    async function fetchFolderContent(targetFolderId: string, currentDepth = 0): Promise<any[]> {
      if (currentDepth > 1) return []; // Unpack up to 1 nested subfolder level

      const query = `'${targetFolderId}' in parents and trashed = false`;
      const fields = 'files(id, name, mimeType, thumbnailLink, webContentLink)';
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&key=${apiKey}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      const res = await fetch(apiUrl, { next: { revalidate: 3600 } });
      if (!res.ok) return [];

      const json = await res.json();
      const rawItems = json.files || [];
      const unpacked: any[] = [];

      for (const item of rawItems) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          const subFiles = await fetchFolderContent(item.id, currentDepth + 1);
          if (subFiles.length > 0) {
            subFiles.forEach(sf => {
              unpacked.push({
                ...sf,
                name: `${item.name} 📁 / ${sf.name}`,
              });
            });
          } else {
            // Keep subfolder item if empty or unreadable
            unpacked.push(item);
          }
        } else {
          unpacked.push(item);
        }
      }
      return unpacked;
    }

    const rawFiles = await fetchFolderContent(folderId, 0);

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
          ? `https://drive.google.com/thumbnail?id=${f.id}&sz=w2000`
          : (f.thumbnailLink || ''),
        previewUrl: isSubFolder
          ? `https://drive.google.com/drive/folders/${f.id}`
          : isPdf
          ? `https://drive.google.com/file/d/${f.id}/preview`
          : `https://drive.google.com/file/d/${f.id}/view`,
        downloadUrl: `https://drive.google.com/file/d/${f.id}/view`,
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

export type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  isPdf: boolean;
  isImage: boolean;
};

const fileMetadataCache = new Map<string, { timestamp: number; data: DriveFileMetadata }>();

export async function getGoogleDriveFileMetadataAction(fileId: string): Promise<DriveFileMetadata | null> {
  if (!fileId) return null;

  const cached = fileMetadataCache.get(fileId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&key=${apiKey}&supportsAllDrives=true`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const mimeType = (data.mimeType || '').toLowerCase();
    const name = (data.name || '').toLowerCase();

    const isPdf = mimeType === 'application/pdf' || name.endsWith('.pdf');
    const isImage = mimeType.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(name);

    const result: DriveFileMetadata = {
      id: data.id,
      name: data.name || 'Dokumen Pendukung',
      mimeType: data.mimeType || '',
      isPdf,
      isImage,
    };

    fileMetadataCache.set(fileId, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    return null;
  }
}
