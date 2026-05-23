// src/server.ts
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { violationBodySchema } from './schemas/violation';
import { violationQueue } from './queues/violationQueue';

// Worker importado explicitamente aqui para que seu ciclo de vida
// seja controlado pelo server — e não como side effect de outra importação.
import './workers/violationWorker';

// Inicializa o Fastify já tipado para o Zod
const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// Adiciona os compiladores do Zod no Fastify
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Intercepta erros de validação para retornar exatamente o status 400 com detalhes
app.setErrorHandler((error, _request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      message: 'Erro de validação no payload',
      errors: error.validation,
    });
  }
  return reply.status(500).send({ message: 'Erro interno do servidor' });
});

// ==========================================
// ROTAS
// ==========================================

// Rota 1: Receber o Webhook
app.post(
  '/webhook/violation',
  { schema: { body: violationBodySchema } },
  async (request, reply) => {
    const { adId, tenantId } = request.body;

    // Requisito (Idempotência): ID único por anúncio+tenant.
    // Se um job com esse ID já estiver na fila, o BullMQ IGNORA a duplicação.
    const customJobId = `${adId}-${tenantId}`;

    app.log.info(`[HTTP] Enfileirando violação: Anúncio ${adId} do Tenant ${tenantId}`);

    const job = await violationQueue.add('takedown', request.body, {
      jobId: customJobId,
    });

    return reply.status(202).send({
      message: 'Violação recebida e enfileirada com sucesso',
      jobId: job.id,
    });
  }
);

// Rota 2: Consultar o Status do Job
// Schema Zod no params garante consistência com a validação adotada no POST
// e evita type casts manuais (as { id: string }).
const jobParamsSchema = z.object({
  id: z.string().min(1, 'O id do job não pode ser vazio'),
});

app.get(
  '/jobs/:id',
  { schema: { params: jobParamsSchema } },
  async (request, reply) => {
    const { id } = request.params;

    // Busca o job diretamente no Redis através do BullMQ
    const job = await violationQueue.getJob(id);

    if (!job) {
      return reply.status(404).send({ message: 'Job não encontrado' });
    }

    // Pega o estado atual (completed, failed, waiting, active, delayed)
    const state = await job.getState();

    // Mapeia o retorno conforme o desafio pede
    return reply.send({
      jobId: job.id,
      status: state,
      attempts: job.attemptsMade,
      result: job.returnvalue ?? null,
      error: job.failedReason ?? null,
    });
  }
);

// ==========================================
// START SERVER
// ==========================================
const start = async () => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();