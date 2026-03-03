# Fio — Definição do MVP

> *Simples como AbacatePay no dia 1. Billing real quando você precisar.*

---

## Princípios do MVP

1. **Dogfood first** — Lucas é o primeiro usuário. O MVP resolve o problema dele.
2. **PIX-only, multi-method ready** — Lança com PIX, mas a arquitetura suporta cartão/boleto sem refatoração.
3. **Simples no dia 1, profundo na semana 2** — Cobranças avulsas tão fáceis quanto AbacatePay. Assinaturas completas quando o dev precisar.
4. **Dados bem estruturados desde o início** — Cada evento de billing é normalizado e auditável. Isso viabiliza métricas, MCP e futuramente analytics/CFO sem reescrever nada.

---

## O que entra no MVP

### 1. Cobranças avulsas (paridade com AbacatePay)

O dev precisa conseguir gerar um PIX em menos de 5 minutos após criar a conta. Isso é table stakes.

```typescript
const charge = await fio.charges.create({
  amount: 4990,
  description: 'Plano Pro - março/2026',
  customer: { email: 'cliente@email.com', name: 'João' },
  pix: { expires_in: 3600 } // 1 hora
})
// → { id, qr_code, qr_code_url, copy_paste, status, expires_at }
```

**Escopo:**
- Criar cobrança PIX (QR code + copia-e-cola)
- Consultar status (pending → paid → expired → refunded)
- Webhook quando pago/expirado
- Reembolso total/parcial
- Expiração configurável

**Por que entra:** Sem isso, o Fio não compete com AbacatePay nem no básico. É a porta de entrada.

---

### 2. Subscription engine (o diferencial)

Isso é o que a AbacatePay não tem e o que justifica o Fio existir.

```typescript
// Criar um plano
const plan = await fio.plans.create({
  name: 'Pro',
  amount: 4990,
  interval: 'month',        // month | year | week
  trial_days: 7,
  payment_methods: ['pix']   // preparado para ['pix', 'card', 'boleto']
})

// Criar assinatura
const subscription = await fio.subscriptions.create({
  plan: 'plan_pro',
  customer: 'cus_abc123'
})
// → trial de 7 dias inicia, primeira cobrança agendada para D+7
```

**State machine completa:**

```
                    ┌──────────┐
          create    │          │   trial expira
       ──────────►  │ trialing │  ──────────────┐
                    │          │                 │
                    └──────────┘                 ▼
                                          ┌──────────┐
                             pagamento ok │          │
                          ┌──────────────  │  active  │ ◄─── pagamento ok (retry)
                          │               │          │
                          │               └────┬─────┘
                          │                    │ pagamento falha
                          │                    ▼
                          │              ┌──────────┐
                          │              │          │
                          │              │ past_due │ ──── retry D+1, D+3, D+7
                          │              │          │
                          │              └────┬─────┘
                          │                   │ todos os retries falharam
                          │                   ▼
                    ┌──────────┐        ┌──────────┐
                    │          │        │          │
                    │  paused  │◄──────  │ canceled │
                    │          │ (pode  │          │
                    └──────────┘ reativar)└────────┘
```

**Escopo:**
- CRUD de planos (mensal, anual, semanal)
- CRUD de assinaturas com state machine completa
- Trial periods configuráveis por plano
- Geração automática de cobrança PIX no vencimento de cada ciclo
- Pix Automático (consent flow) com fallback para QR code
- Dunning: retry configurável (default D+1, D+3, D+7)
- Cancelamento (imediato ou no fim do ciclo)
- Pause/resume de assinatura
- Webhooks de lifecycle: `subscription.created`, `subscription.activated`, `subscription.past_due`, `subscription.canceled`, `invoice.created`, `invoice.paid`, `invoice.failed`

**O que NÃO entra no MVP:**
- Proration em upgrade/downgrade (v1.1)
- Usage-based billing (v2)
- Cupons e descontos (v1.1)
- Multiple subscriptions por customer (v1.1)

---

### 3. Customers

```typescript
const customer = await fio.customers.create({
  name: 'João Silva',
  email: 'joao@email.com',
  tax_id: '123.456.789-00'  // CPF ou CNPJ
})
```

**Escopo:**
- CRUD de customers
- CPF/CNPJ com validação
- Email como identificador secundário
- Histórico de cobranças e assinaturas por customer
- Consent do Pix Automático vinculado ao customer

---

### 4. Webhooks

```typescript
// O dev registra uma URL e recebe eventos
POST https://meuapp.com/webhooks/fio
{
  "event": "invoice.paid",
  "data": {
    "invoice_id": "inv_123",
    "subscription_id": "sub_abc",
    "customer_id": "cus_xyz",
    "amount": 4990,
    "paid_at": "2026-03-15T14:32:00Z"
  },
  "created_at": "2026-03-15T14:32:01Z"
}
```

**Escopo:**
- Registro de endpoint(s) de webhook
- Retry automático com backoff exponencial (1min, 5min, 30min, 2h, 24h)
- Assinatura HMAC para verificação
- Log de entregas (sucesso/falha) no dashboard
- Eventos: charge.*, subscription.*, invoice.*, customer.*

---

### 5. Dashboard web

Não precisa ser bonito. Precisa ser funcional.

**Escopo:**
- Login/cadastro (email + senha, magic link)
- API keys (live + test)
- Lista de customers, cobranças, assinaturas
- Detalhe de cada entidade com timeline de eventos
- Métricas básicas: MRR atual, churn rate (últimos 30d), número de assinaturas ativas
- Logs de webhooks
- Sandbox mode (toggle entre test/live)

**O que NÃO entra:**
- Métricas avançadas: cohort analysis, LTV, MRR breakdown (v1.1)
- Multi-user / team management (v1.1)
- Customização de branding (v1.1)

---

### 6. SDK TypeScript

```bash
npm install @fio-pay/sdk
```

**Escopo:**
- Client com tipagem completa (TypeScript-first)
- Todos os endpoints da API
- Tratamento de erros tipado (FioError, FioValidationError, FioAPIError)
- Verificação de webhook signature
- Exemplo de integração com Next.js (o framework mais usado por indie devs BR)
- Open source desde o dia 1

**O que NÃO entra:**
- SDK Python (v1.1 — segundo SDK)
- SDK Go, Ruby, etc. (v2+)
- CLI (v1.1)

---

### 7. Documentação

A documentação É o produto para devs. Precisa ser melhor que a da AbacatePay.

**Escopo:**
- Quickstart: "Primeira cobrança em 5 minutos"
- Guia: "Subscription billing completo em 30 minutos"
- API Reference completa (OpenAPI spec → docs auto-geradas)
- Exemplos copiáveis em cada endpoint
- Sandbox interativo (testa direto na doc)
- Página de webhooks com payload de exemplo para cada evento
- llms.txt (para agentes de IA conseguirem entender a API — a AbacatePay já faz isso)

---

### 8. MCP Server (básico)

Diferencial narrativo + funcional. Não precisa ser enterprise-grade no MVP, mas precisa existir e funcionar.

```
Agente: "Crie uma assinatura do plano Pro para o cliente joao@email.com"
Fio MCP: subscription.created → retorna ID e status
```

**Escopo:**
- Tools: criar cobrança, criar assinatura, listar assinaturas de um customer, consultar status, cancelar assinatura
- Autenticação via API key (mesma do SDK)
- Log de cada ação do agente (quem, quando, o quê) — audit trail básico
- Open source

**O que NÃO entra:**
- Approval workflows (v1.1)
- Rate limiting por agente (v1.1)
- Scoping de permissões granular (v1.1)

---

## O que NÃO entra no MVP (e quando entra)

| Feature | Por que não agora | Quando |
|---------|-------------------|--------|
| **Cartão de crédito** | Adquirente, antifraude, PCI, chargeback — multiplica complexidade em 3x | v1.1 (mês 4-5) |
| **Boleto** | Registro bancário, conciliação D+1/D+2, segunda via | v1.1 (mês 5-6) |
| **Link de pagamento** | Nice-to-have, não é core de billing engine | v1.1 |
| **Portal self-service** | Frontend completo para o cliente final — escopo grande | v1.1 |
| **Proration** | Edge cases complexos (upgrade mid-cycle, downgrade, créditos) | v1.1 |
| **Cupons/descontos** | Lógica de desconto % vs fixo, duração, limite de uso | v1.1 |
| **Usage-based billing** | Modelo de dados diferente (metering, aggregation) | v2 |
| **Split billing** | Marketplaces, múltiplos recebedores, compliance | v2 |
| **NF-e automática** | Integração com prefeitura, certificado digital | v2 |
| **CFO insights / AI analytics** | Requer volume de dados e modelo treinado | v2+ |
| **Multi-tenant** | Plataformas com sub-contas — complexidade de permissões | v2 |
| **CLI** | `fio subscriptions list`, `fio charges retry` | v1.1 |
| **SDKs adicionais** | Python (v1.1), Go/Ruby/PHP (v2) | v1.1 / v2 |

---

## Arquitetura de dados (preparada para o futuro)

Mesmo sem construir CFO/analytics no MVP, a estrutura de dados deve ser pensada para viabilizar isso depois:

```
events (append-only log)
├── event_id
├── event_type (charge.created, subscription.activated, invoice.paid, ...)
├── entity_type (charge, subscription, invoice, customer)
├── entity_id
├── data (JSON — snapshot do estado)
├── metadata (JSON — contexto: agent_id, ip, sdk_version)
├── created_at
└── idempotency_key

payment_methods (multi-method ready)
├── id
├── customer_id
├── type (pix | card | boleto)  ← só PIX no MVP, mas o campo existe
├── provider (stark_bank | celcoin | ...)
├── provider_reference
├── details (JSON — chave PIX, dados do consent, etc.)
├── is_default
└── created_at
```

O event log normalizado é o que permite no futuro calcular MRR, churn, cohort e alimentar um "CFO AI" — sem migração de dados.

---

## Stack técnica sugerida

| Camada | Tecnologia | Racional |
|--------|-----------|----------|
| API | Node.js + Hono (ou Fastify) | Performance, tipagem com TS, ecossistema familiar para indie devs |
| Banco | PostgreSQL | Confiável, suporta JSONB para flexibilidade, event sourcing-friendly |
| Fila | BullMQ (Redis) | Jobs de dunning, retry, webhook delivery |
| Infra | Railway ou Fly.io | Deploy simples, pricing justo, bom para MVP. Migra para AWS/GCP depois |
| Dashboard | Next.js | Mesmo ecossistema do SDK, SSR para performance |
| Docs | Mintlify ou Fumadocs | Docs bonitas, API playground, fácil de manter |
| MCP Server | TypeScript (oficial) | Mesmo ecossistema, menos overhead |
| PSP parceiro | Stark Bank ou Celcoin | API moderna, suporte a Pix Automático, pricing competitivo |

---

## Timeline estimada (dev solo)

| Semana | Entrega |
|--------|---------|
| 1-2 | Modelo de dados, API de customers e charges, integração PSP (PIX básico) |
| 3-4 | Subscription engine (state machine, criação de plano, criação de assinatura) |
| 5-6 | Dunning (retry automático), webhooks (delivery + retry), Pix Automático (consent) |
| 7-8 | Dashboard web (básico: login, API keys, listagens, métricas MRR/churn) |
| 9-10 | SDK TypeScript (tipagem completa, examples), documentação (quickstart, API ref) |
| 11-12 | MCP server básico, sandbox mode, polimento, dogfooding nos próprios projetos |
| 13 | Landing page, post no TabNews, launch |

~3 meses para o MVP, assumindo dedicação significativa. Pode comprimir para 8-10 semanas se cortar dashboard para o mínimo absoluto e usar docs mais simples.

---

## Critério de "pronto para lançar"

O MVP está pronto quando:

1. Lucas consegue criar um plano de assinatura no Fio, assinar com um cliente de teste, receber o PIX no sandbox, ver a subscription mudar de estado, e receber o webhook — tudo em menos de 30 minutos
2. Um segundo dev (amigo, conhecido) consegue fazer o mesmo seguindo só a documentação, sem ajuda
3. O dunning funciona: cobrança falha → retry D+1 → retry D+3 → retry D+7 → cancela
4. O dashboard mostra MRR e número de assinaturas ativas corretamente
5. O MCP server consegue criar uma cobrança e consultar uma assinatura via agente

---

*Documento vivo — atualizar conforme decisões evoluem.*
