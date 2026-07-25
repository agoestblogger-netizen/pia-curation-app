
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
    'groupName',      // Group (mis. "Kantor Pusat") bisa mengidentifikasi pengusul
    'teamMembers'
  ];

  for (const field of fieldsToMask) {
    if (field in masked) {
      if (Array.isArray(masked[field])) {
        // If it's an array (like teamMembers), clear it so UI shows '-'
        (masked as any)[field] = [];
      } else if (masked[field] !== null && masked[field] !== undefined) {
        // Set to null so UI fallback pattern `value || '-'` naturally shows '-'
        (masked as any)[field] = null;
      }
    }
  }

  return masked;
}
