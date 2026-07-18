import { Prisma } from '@prisma/client';

// P2002 = unique constraint încălcat; P2003 = foreign key încălcat (ex: onDelete Restrict);
// P2025 = înregistrarea din where nu există; P2034 = tranzacție picată la serializare
export function isPrismaError(err: unknown, code: 'P2002' | 'P2003' | 'P2025' | 'P2034'): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}
