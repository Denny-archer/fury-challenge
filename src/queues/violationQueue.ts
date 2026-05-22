// src/queues/violationQueue.ts
import { Queue, Worker, Job } from 'bullmq';
import { ViolationPayload } from '../schemas/violation';

// Configuração de conexão com o Redis (rodando via Docker local)
const redisConnection = { host: '127.0.0.1', port: 6379 };

// ==========================================
// 1. A FILA (Queue)
// Responsável por receber os jobs do nosso endpoint POST
// ==========================================
export const violationQueue = new Queue('violation-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    // Requisito: backoff exponencial com máx 3 tentativas
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }, 
    // Requisito: Precisamos manter os dados para o endpoint GET /jobs/:id
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ==========================================
// 2. O WORKER
// Responsável por pegar os jobs da fila e processar (em background)
// ==========================================
export const violationWorker = new Worker(
  'violation-queue',
  async (job: Job<ViolationPayload>) => {
    console.log(`[Worker] Iniciando processamento do Job ${job.id} | Anúncio: ${job.data.adId}`);

    // Requisito: Simular a integração com a Meta API
    // Usamos a API do JSONPlaceholder apenas para testar o fluxo HTTP
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');

    if (!response.ok) {
      // Se lançarmos um erro aqui, o BullMQ automaticamente engatilha o Retry + Backoff
      throw new Error(`Falha na API da Meta. Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Worker] Job ${job.id} concluído com sucesso!`);
    
    // O que retornamos aqui é salvo pelo BullMQ no campo 'returnvalue' do Job
    return { success: true, apiMockData: data };
  },
  { connection: redisConnection }
);

// Event listeners opcionais para facilitar o log no terminal
violationWorker.on('completed', job => console.log(`✅ [Worker] Job ${job.id} finalizado.`));
violationWorker.on('failed', (job, err) => console.error(`❌ [Worker] Job ${job?.id} falhou. Motivo: ${err.message}`));