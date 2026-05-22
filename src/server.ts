// src/server.ts
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { violationBodySchema } from './schemas/violation';
import { violationQueue } from './queues/violationQueue';

// Inicializa o Fastify já tipado para o Zod
const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// Adiciona os compiladores do Zod no Fastify
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Intercepta erros de validação para retornar exatamente o status 400 com detalhes
app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      message: 'Erro de validação no payload',
      errors: error.validation
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
    const { adId, tenantId, violationType } = request.body;

    // Requisito (Idempotência): Criamos um ID único. 
    // Se um job com esse ID já estiver na fila (ativo, aguardando ou falhado), o BullMQ IGNORA a duplicação.
    const customJobId = `${adId}-${tenantId}`;

    console.log(`[HTTP] Enfileirando Violação: Anúncio ${adId} do Tenant ${tenantId}`);

    // Adiciona o job na fila. O nome 'takedown' é apenas uma etiqueta interna.
    const job = await violationQueue.add('takedown', request.body, {
      jobId: customJobId
    });

    return reply.status(202).send({
      message: 'Violação recebida e enfileirada com sucesso',
      jobId: job.id
    });
  }
);

// Rota 2: Consultar o Status do Job
app.get('/jobs/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  // Busca o job diretamente no Redis através do BullMQ
  const job = await violationQueue.getJob(id);

  if (!job) {
    return reply.status(404).send({ message: 'Job não encontrado' });
  }

  // Pega o estado atual (completed, failed, waiting, active, delayed)
  const state = await job.getState();

  // Mapeia o retorno exatamente como o desafio pede
  return reply.send({
    jobId: job.id,
    status: state,
    attempts: job.attemptsMade,
    result: job.returnvalue || null,
    error: job.failedReason || null
  });
});

// ==========================================
// START SERVER
// ==========================================
const start = async () => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
    console.log('🚀 Servidor rodando em http://localhost:3333');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();