import { z } from 'zod';
import { idParamSchema } from './api';
import { passwordSchema } from './auth';

export const licenseCategorySchema = z.enum(['B', 'BE', 'C1', 'C1E', 'C', 'CE']);
export type LicenseCategory = z.infer<typeof licenseCategorySchema>;

export const absenceTypeSchema = z.enum(['VACATION', 'SICK_LEAVE', 'OTHER']);
export type AbsenceType = z.infer<typeof absenceTypeSchema>;

const licenseCategoriesSchema = z
  .array(licenseCategorySchema)
  .min(1, 'Cel puțin o categorie de permis')
  .refine((values) => new Set(values).size === values.length, 'Categorii duplicate');

// normalizăm separatorii ("0722 123 456" → "0722123456"), apoi validăm prefixul românesc
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.\-()]+/g, ''))
  .pipe(z.string().regex(/^(\+40|0)\d{9}$/, 'Telefon invalid (ex: 0722 123 456)'));

export const createDriverSchema = z.object({
  name: z.string().trim().min(2, 'Numele e prea scurt').max(100),
  email: z.email('Email invalid'),
  password: passwordSchema,
  phone: phoneSchema.nullable().optional(),
  licenseCategories: licenseCategoriesSchema,
  licenseExpiresAt: z.coerce.date().nullable().optional(),
});

// email-ul și parola nu se schimbă pe aici: emailul e identitatea contului,
// iar resetarea parolei va fi un flow separat (nu admin-ul scrie parola șoferului)
export const updateDriverSchema = z
  .object({
    name: z.string().trim().min(2, 'Numele e prea scurt').max(100),
    phone: phoneSchema.nullable(),
    licenseCategories: licenseCategoriesSchema,
    licenseExpiresAt: z.coerce.date().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nimic de actualizat');

export const listDriversQuerySchema = z.object({
  active: z.stringbool().optional(),
});

export const createAbsenceSchema = z
  .object({
    type: absenceTypeSchema,
    startsAt: z.iso.date('Dată invalidă (format YYYY-MM-DD)'),
    endsAt: z.iso.date('Dată invalidă (format YYYY-MM-DD)'),
    note: z.string().trim().max(500).optional(),
  })
  // comparația de string-uri e corectă pentru date ISO (ordine lexicografică = cronologică)
  .refine((value) => value.startsAt <= value.endsAt, {
    message: 'Sfârșitul nu poate fi înaintea începutului',
    path: ['endsAt'],
  });

export const absenceParamsSchema = idParamSchema.extend({
  absenceId: z.cuid('Id invalid'),
});

export const absenceSchema = z.object({
  id: z.string(),
  type: absenceTypeSchema,
  startsAt: z.iso.date(),
  endsAt: z.iso.date(),
  note: z.string().nullable(),
});

export const driverSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.email(),
  phone: z.string().nullable(),
  licenseCategories: z.array(licenseCategorySchema),
  licenseExpiresAt: z.iso.datetime().nullable(),
  isActive: z.boolean(),
});

export const driverDetailSchema = driverSchema.extend({
  absences: z.array(absenceSchema),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>;
export type CreateAbsenceInput = z.infer<typeof createAbsenceSchema>;
export type AbsenceDto = z.infer<typeof absenceSchema>;
export type DriverDto = z.infer<typeof driverSchema>;
export type DriverDetailDto = z.infer<typeof driverDetailSchema>;
