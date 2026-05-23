// src/queues/violationQueue.ts
import { Queue } from 'bullmq';

// Configuração de conexão com o Redis (rodando via Docker local)
export const redisConnection = { host: '127.0.0.1', port: 6379 };

// ==========================================
// A FILA (Queue)
// Responsável por receber os jobs do endpoint POST.
// O Worker foi separado em src/workers/violationWorker.ts
// para evitar que ele suba automaticamente ao importar a Queue.
// ==========================================
export const violationQueue = new Queue('violation-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    // Requisito: backoff exponencial com máx 3 tentativas
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    // Requisito: manter os dados para o endpoint GET /jobs/:id
    // Remover jobs concluídos/falhados tornaria o GET /jobs/:id
    // inútil para qualquer job finalizado — mantemos o histórico completo.
    removeOnComplete: false,
    removeOnFail: false,
  },
});