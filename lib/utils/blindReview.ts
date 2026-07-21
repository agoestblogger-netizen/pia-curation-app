export const BLIND_REVIEW_TEXT = '[Disembunyikan]';

export function maskProposalIdentity<T extends Record<string, any>>(proposal: T): T {
  // If the proposal is null or undefined, return it as is
  if (!proposal) return proposal;

  // Create a shallow copy to avoid mutating the original object
  const masked = { ...proposal };

  // List of fields to mask
  const fieldsToMask = [
    'proposerName',
    'proposerUnitKerja',
    'proposerEmail',
    'proposerOrg',
    'proposerDirectorate',
    'proposerDivision',
    'proposerDepartment',
    'teamMembers'
  ];

  for (const field of fieldsToMask) {
    if (field in masked) {
      if (Array.isArray(masked[field])) {
        // If it's an array (like teamMembers), clear it
        (masked as any)[field] = [];
      } else if (masked[field] !== null && masked[field] !== undefined) {
        // If it's a string or other value, replace with the blind review text
        (masked as any)[field] = BLIND_REVIEW_TEXT;
      }
    }
  }

  return masked;
}
