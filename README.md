# FURY - Desafio Técnico (Sprint 1) 🚀

Mini-API desenvolvida em Node.js para atuar como o gestor autônomo de tráfego pago (Integração Meta Ads). O sistema recebe webhooks de violação, valida os payloads rigorosamente e enfileira jobs assíncronos para processamento de takedown.

## 🛠️ Stack Tecnológica

* **Back-end:** Node.js com [Fastify](https://fastify.dev/) (alta performance e baixo overhead).
* **Linguagem:** TypeScript (Tipagem estática rigorosa, sem `any`).
* **Validação:** [Zod](https://zod.dev/) integrado nativamente às rotas.
* **Fila de Processamento:** [BullMQ](https://docs.bullmq.io/) apoiado por um banco de dados **Redis**.

## 🧠 Decisões de Arquitetura e Clean Code

1. **Separação de Responsabilidades:** Rotas, Schemas (Zod) e Queues/Workers estão isolados em seus respectivos diretórios, facilitando a manutenção e testes futuros.
2. **Idempotência:** Implementada nativamente através da injeção de um `jobId` customizado (`adId-tenantId`) no BullMQ. Isso garante que webhooks duplicados pela Meta não gerem processamento redundante.
3. **Resiliência (Retry & Backoff):** O Worker está configurado com estratégia de *Exponential Backoff* (máximo de 3 tentativas) para lidar com instabilidades na API externa, garantindo que o sistema se recupere de falhas temporárias (HTTP 4xx/5xx).
4. **Validação Fail-Fast:** O Zod intercepta payloads malformados antes mesmo de atingirem o *controller*, retornando `400 Bad Request` com a árvore de erros detalhada.

---

## ⚙️ Como rodar o projeto localmente

### Pré-requisitos
* [Node.js](https://nodejs.org/) (v18+ recomendado)
* [Docker](https://www.docker.com/) e Docker Compose (para subir o Redis)

### Passo a Passo

1. **Clone o repositório e acesse a pasta:**
   ```bash
   git clone <url-do-seu-repositorio>
   cd fury-challenge
    ```
2. **Suba o contêiner do Redis:**
    ```bash
    docker compose up -d
    ```
3. **Instale as dependências:**
    ```bash
    npm install
    ```
1. **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```
* O servidor estará rodando em http://localhost:3333

**Endpoints da API**
* 1. Receber Webhook de Violação
    POST /webhook/violation

    Payload de Sucesso:

    JSON
    {
    "adId": "ad-998877",
    "tenantId": "tenant-abc",
    "violationType": "PROHIBITED_TERM",
    "severity": "HIGH",
    "detectedAt": "2026-05-22T14:30:00Z"
    }
    Retorno Esperado (202 Accepted):

    JSON
    {
    "message": "Violação recebida e enfileirada com sucesso",
    "jobId": "ad-998877-tenant-abc"
    }
* 2. Consultar Status do Job
    GET /jobs/:id

    Exemplo de Rota: http://localhost:3333/jobs/ad-998877-tenant-abc

    Retorno Esperado (200 OK):

    JSON
    {
    "jobId": "ad-998877-tenant-abc",
    "status": "completed",
    "attempts": 1,
    "result": {
        "success": true,
        "apiMockData": { ... }
    },
    "error": null
    }
**Desenvolvido por Denilson Adelino Jose.**