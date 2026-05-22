import { z } from 'zod';

export const violationBodySchema = z.object({
    adId: z.string({ required_error: 'adId é obrigatório' }),
    tenantId: z.string({ required_error: 'tenantId é obrigatório' }),
    violationType