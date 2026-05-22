// src/schemas/violation.ts
import { z } from 'zod';

export const violationBodySchema = z.object({
  adId: z.string({ required_error: 'adId é obrigatório' }),
  tenantId: z.string({ required_error: 'tenantId é obrigatório' }),
  violationType: z.enum(['PROHIBITED_TERM', 'BRAND_VIOLATION', 'COMPLIANCE_FAIL'], {
    required_error: 'violationType é obrigatório e deve ser válido',
  }),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    required_error: 'severity é obrigatório e deve ser válido',
  }),
  detectedAt: z.string().datetime({ message: 'detectedAt deve ser um ISO 8601 datetime válido' })
});

// Inferimos o tipo TypeScript a partir do Schema (Clean Code: escrevemos a tipagem uma vez só)
export type ViolationPayload = z.infer<typeof violationBodySchema>;