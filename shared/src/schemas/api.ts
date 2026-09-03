import { z } from 'zod';

export const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// toate id-urile din DB sunt cuid clasic (Prisma @default(cuid()), nu varianta cuid2).
// z.cuid2() (nu z.cuid(), deprecated în Zod 4) acceptă totuși id-urile clasice — verificat
// manual cu un id real din DB — dar regexul lui cuid2 e mult mai permisiv decât al lui cuid
// (`/^[0-9a-z]+$/`, orice string alfanumeric minuscul, fără lungime minimă reală), deci
// singur n-ar mai respinge „fail fast" un id clar greșit. `.min(20)` reface acea gardă
// (id-urile reale au 25 caractere) fără să depindă de formatul exact cuid vs cuid2.
export function idSchema(message = 'Id invalid') {
  return z.cuid2(message).min(20, message);
}

export const idParamSchema = z.object({ id: idSchema() });

// normalizăm separatorii ("0722 123 456" → "0722123456"), apoi validăm prefixul românesc;
// acceptă și fixe (021...), nu doar mobile
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.\-()]+/g, ''))
  .pipe(z.string().regex(/^(\+40|0)\d{9}$/, 'Telefon invalid (ex: 0722 123 456)'));

// trim + lowercase înainte de verificarea de format, ca un email cu spații/majuscule să nu
// pice de formă (case unificat, ca „Test@Ex.com" și „test@ex.com" să fie aceeași adresă la
// login și la unicitate — User.email)
export const emailSchema = z.string().trim().toLowerCase().email('Email invalid');
