import { z } from 'zod';

export const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// toate id-urile din DB sunt cuid; un id malformat devine 400 fără să mai atingă baza
export const idParamSchema = z.object({ id: z.cuid('Id invalid') });
