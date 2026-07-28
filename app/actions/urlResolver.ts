'use server';

import { resolveTextUrls, resolveUrl } from '@/lib/utils/urlResolver';
import { 
  extractDriveFolderUrls, 
  extractSupportingImageUrls, 
  extractGoogleWorkspaceUrls, 
  extractUnhandledUrls,
  ResubmitMediaPackage 
} from '@/lib/utils/resubmitMediaExtractor';

export async function resolveResubmitMediaAction(text: string | null | undefined, mainUrl: string | null | undefined): Promise<ResubmitMediaPackage> {
  const resolvedText = await resolveTextUrls(text || '');
  const resolvedMainUrl = mainUrl ? await resolveUrl(mainUrl) : mainUrl;

  const driveFolders = extractDriveFolderUrls(resolvedText, resolvedMainUrl);
  const images = extractSupportingImageUrls(resolvedText + ' ' + (resolvedMainUrl || ''));
  const workspaceItems = extractGoogleWorkspaceUrls(resolvedText, resolvedMainUrl);
  const unhandledItems = extractUnhandledUrls(resolvedText, resolvedMainUrl);

  return {
    driveFolders,
    images,
    workspaceItems,
    unhandledItems,
  };
}
