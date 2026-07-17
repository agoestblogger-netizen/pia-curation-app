import { z } from 'zod';

export const SCREENING_VERDICTS = [
  'lolos',
  'duplication',
  'mapped',
  'non_compliance',
  'low_impact'
] as const;

export const screeningSchema = z.object({
  assignmentId: z.coerce.number(),
  verdict: z.enum(SCREENING_VERDICTS),
  notes: z.string().optional(),
  recommendation: z.string().optional(),
});

export type ScreeningVerdict = typeof SCREENING_VERDICTS[number];

export const SCREENING_VERDICT_LABELS: Record<ScreeningVerdict, string> = {
  lolos: 'Lolos Screening',
  duplication: 'Sudah pernah menang / tidak ada improvement signifikan',
  mapped: 'Sudah direncanakan secara detail / sudah dikerjakan',
  non_compliance: 'Tidak ada peluang untuk lolos regulasi',
  low_impact: 'Not scalable',
};

export const SCREENING_VERDICT_COLORS: Record<ScreeningVerdict, string> = {
  lolos: 'bg-green-100 text-green-800 border-green-200',
  duplication: 'bg-orange-100 text-orange-800 border-orange-200',
  mapped: 'bg-blue-100 text-blue-800 border-blue-200',
  non_compliance: 'bg-red-100 text-red-800 border-red-200',
  low_impact: 'bg-gray-100 text-gray-800 border-gray-200',
};
