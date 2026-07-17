import { Prisma } from '@prisma/client';

// P2002 = unique constraint încălcat; P2025 = înregistrarea din where nu există
export function isPrismaError(err: unknown, code: 'P2002' | 'P2025'): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}
