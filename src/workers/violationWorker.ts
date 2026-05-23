// src/workers/violationWorker.ts
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/violationQueue';
import { ViolationPayload } from '../schemas/violation';

// ==========================================
// O WORKER
// Responsável por pegar os jobs da fila e processar (em background).
// Separado da Queue para que importar a fila em server.ts
// não dispare o Worker como side effect involuntário.
// ==========================================
export const violationWorker = new Worker(
  'violation-queue',
  async (job: Job<ViolationPayload>) => {
    console.log(`[Worker] Iniciando processamento do Job ${job.id} | Anúncio: ${job.data.adId}`);

    // AbortController para definir um limite de tempo (Timeout) de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // Requisito: simular integração com a Meta API via JSONPlaceholder
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        signal: controller.signal,
      });

      // Limpa o temporizador se a requisição responder antes dos 5 segundos
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Lançar erro aqui faz o BullMQ acionar o Retry + Backoff automaticamente
        throw new Error(`Falha na API da Meta. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Worker] Job ${job.id} concluído com sucesso!`);

      // O retorno é salvo pelo BullMQ no campo 'returnvalue' do Job
      return { success: true, apiMockData: data };

    } catch (error: unknown) {
      // Garante que o temporizador seja limpo caso ocorra outro erro antes do timeout
      clearTimeout(timeoutId);

      // Verifica com segurança se é um Error antes de acessar .name
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout ao conectar com a API da Meta (limite de 5s excedido)');
      }

      // Repassa falhas de rede ou respostas HTTP de erro para o BullMQ executar o retry
      throw error;
    }
  },
  { connection: redisConnection }
);

// Event listeners para facilitar o log no terminal
violationWorker.on('completed', (job) =>
  console.log(`✅ [Worker] Job ${job.id} finalizado.`)
);
violationWorker.on('failed', (job, err) =>
  console.error(`❌ [Worker] Job ${job?.id} falhou. Motivo: ${err.message}`)
);