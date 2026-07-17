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

// normalizăm separatorii ("0722 123 456" → "0722123456"), apoi validăm prefixul românesc;
// acceptă și fixe (021...), nu doar mobile
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.\-()]+/g, ''))
  .pipe(z.string().regex(/^(\+40|0)\d{9}$/, 'Telefon invalid (ex: 0722 123 456)'));
