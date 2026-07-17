import { z } from 'zod';
import { phoneSchema } from './api';

export const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Numele e prea scurt').max(150),
  contactName: z.string().trim().min(2, 'Numele e prea scurt').max(100).nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  email: z.email('Email invalid').nullable().optional(),
  address: z.string().trim().min(3, 'Adresa e prea scurtă').max(300).nullable().optional(),
});

export const updateClientSchema = createClientSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nimic de actualizat');

// search: filtrare după nume (case-insensitive, potrivire parțială) — o va folosi
// și UI-ul de autocomplete, și tool-ul get_client_by_name al agentului.
// string gol (input de UI netastat) = fără filtru, nu eroare
export const listClientsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
});

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
export type ClientDto = z.infer<typeof clientSchema>;
