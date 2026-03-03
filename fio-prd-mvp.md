# Fio — Product Requirements Document (MVP / v1.0)

**Produto:** Fio — API de subscription billing para PIX
**Versão:** v1.0 "Foundation"
**Autor:** Lucas Galhardo
**Data:** Março 2026
**Status:** Em definição

---

## 1. Problem Statement

Desenvolvedores brasileiros que constroem SaaS com modelo de assinatura não têm uma ferramenta developer-friendly para gerenciar billing recorrente via PIX. As opções atuais são: gateways simples como AbacatePay (que resolvem cobranças avulsas mas não têm subscription engine real — sem state machine, sem dunning, sem trial management), plataformas como Vindi e Asaas (que têm billing mas com DX mediana e complexidade desnecessária para indie devs), ou construir tudo internamente (doloroso e propenso a erros).

O problema atinge especialmente **indie devs e micro-SaaS** — desenvolvedores solo ou pequenos times que precisam cobrar assinaturas mas não têm equipe para construir infraestrutura financeira. Com 175 milhões de usuários PIX no Brasil e o lançamento do Pix Automático em junho/2025, a demanda por billing recorrente via PIX existe, mas nenhum player atende com a combinação de simplicidade + profundidade que o mercado precisa.

O custo de não resolver: devs brasileiros continuam improvisando billing com cobranças em loop, perdem receita por falta de dunning inteligente, não conseguem oferecer trial periods sem código manual, e não têm visibilidade sobre MRR/churn. Isso limita o crescimento de SaaS brasileiros e cede mercado para soluções genéricas ou gringas que não entendem o contexto PIX.

---

## 2. Goals

### Goals do usuário (o que o dev ganha)

- **Primeira cobrança PIX em < 5 minutos** após criar conta — onboarding tão simples quanto AbacatePay
- **Subscription lifecycle completo sem código custom** — trial, dunning, cancelamento, pause/resume gerenciados pelo Fio
- **Visibilidade sobre a saúde do negócio** — MRR, churn, assinaturas ativas visíveis no dashboard sem planilha Excel

### Goals do negócio (o que o Fio ganha)

- **50 devs com integração ativa** (≥1 cobrança real) nos primeiros 6 meses
- **R$ 500K/mês em GMV** processado em 6 meses
- **NPS > 60** entre devs que completaram a integração
- **Tempo médio para primeira cobrança < 15 minutos** (medido do cadastro ao QR code gerado)

---

## 3. Non-Goals (Explicitamente Fora de Escopo)

- **Cartão de crédito e boleto.** Adicionam complexidade significativa (adquirente, PCI, antifraude, registro bancário). A arquitetura suporta multi-método desde o dia 1, mas a implementação começa com PIX. Cartão e boleto entram na v2.0.

- **Portal self-service para o cliente final.** Um frontend embeddable para o usuário final gerenciar sua assinatura é valioso, mas é um produto frontend completo. O MVP foca na API — o dev controla a experiência do cliente final. Portal entra na v2.0.

- **Proration em upgrades/downgrades.** Os edge cases de cálculo proporcional (upgrade mid-cycle, downgrade com crédito, mudança de intervalo) são complexos. No MVP, upgrade/downgrade aplica o novo valor no próximo ciclo. Proration entra na v2.0.

- **Usage-based billing.** Cobrança por uso requer um modelo de dados diferente (metering, aggregation, thresholds). O MVP foca em assinatura de valor fixo com ciclo regular. Usage-based entra na v2.0.

- **NF-e automática.** Emissão de nota fiscal de serviço envolve integração com prefeituras, certificado digital e regras fiscais por município. Complexidade desproporcional para o MVP. Entra na v2.0.

- **Split billing / marketplace.** Distribuição de receita entre múltiplos recebedores requer compliance adicional e lógica de repasse. Entra na v2.0.

- **CFO insights / AI analytics.** A estrutura de dados suporta analytics desde o dia 1 (event log normalizado), mas features de inteligência artificial sobre dados financeiros são prematuras sem volume de dados. Entra na v2.0+.

---

## 4. User Stories

### Persona: Dev Indie (Lucas)

Desenvolvedor solo construindo SaaS, precisa cobrar assinaturas, é o primeiro usuário do Fio.

**US-01** — Como dev indie, quero gerar uma cobrança PIX com uma chamada de API para que eu possa aceitar pagamentos sem construir integração com gateway.
- Prioridade: P0

**US-02** — Como dev indie, quero criar um plano de assinatura (mensal, anual ou semanal) com valor e trial configuráveis para que meus clientes possam assinar meu SaaS.
- Prioridade: P0

**US-03** — Como dev indie, quero que o Fio gere automaticamente a cobrança PIX no vencimento de cada ciclo para que eu não precise criar cobranças manualmente a cada mês.
- Prioridade: P0

**US-04** — Como dev indie, quero que o Fio faça retry automático quando um pagamento falha (D+1, D+3, D+7) para que eu não perca receita por falhas temporárias.
- Prioridade: P0

**US-05** — Como dev indie, quero receber webhooks quando uma assinatura muda de estado (ativada, pagamento falhou, cancelada) para que meu sistema possa reagir automaticamente (ex: bloquear acesso se cancelou).
- Prioridade: P0

**US-06** — Como dev indie, quero oferecer trial de N dias para que meus clientes testem antes de pagar, e a primeira cobrança aconteça automaticamente quando o trial expirar.
- Prioridade: P0

**US-07** — Como dev indie, quero ver MRR atual, churn rate e número de assinaturas ativas em um dashboard para que eu saiba a saúde financeira do meu SaaS sem planilha.
- Prioridade: P0

**US-08** — Como dev indie, quero ter um ambiente sandbox com QR codes de teste para que eu possa testar toda a integração sem dinheiro real.
- Prioridade: P0

**US-09** — Como dev indie, quero que meus clientes possam usar Pix Automático (autorização única para cobranças futuras) para que o pagamento seja transparente, mas com fallback para QR code se o banco não suportar.
- Prioridade: P0

**US-10** — Como dev indie, quero pausar e reativar a assinatura de um cliente via API para que eu possa oferecer "férias" sem cancelar.
- Prioridade: P1

**US-11** — Como dev indie, quero processar reembolsos totais e parciais via API para que eu possa resolver disputas sem acessar o gateway diretamente.
- Prioridade: P1

### Persona: Agente de IA

Agente autônomo que precisa executar operações de billing programaticamente.

**US-12** — Como agente de IA, quero criar cobranças e gerenciar assinaturas via MCP server para que eu possa automatizar billing no workflow do meu operador.
- Prioridade: P1

**US-13** — Como operador de um agente de IA, quero ver um audit trail de cada ação que o agente executou no Fio para que eu tenha visibilidade e possa auditar operações financeiras.
- Prioridade: P1

### Edge cases e estados de erro

**US-14** — Como dev indie, quero que quando todos os retries de dunning falharem, a assinatura seja automaticamente cancelada e eu receba um webhook para que meu sistema bloqueie o acesso do cliente.
- Prioridade: P0

**US-15** — Como dev indie, quero que se um webhook falhar na entrega, o Fio faça retry com backoff exponencial para que eu não perca eventos por indisponibilidade temporária do meu servidor.
- Prioridade: P0

**US-16** — Como dev indie, quero que se o Pix Automático falhar (consent negado, banco não suporta), o Fio automaticamente gere um QR code como fallback para que o cliente ainda consiga pagar.
- Prioridade: P0

**US-17** — Como dev indie, quero que a API retorne erros claros e tipados (validação, autenticação, recurso não encontrado) para que eu possa tratar cada caso no meu código.
- Prioridade: P0

---

## 5. Requirements

### Must-Have (P0) — O Fio não lança sem isso

**R-01: API de Cobranças PIX**
Criar, consultar e cancelar cobranças PIX via API REST.
- Acceptance criteria:
  - [ ] `POST /charges` gera cobrança com QR code dinâmico, URL do QR code e string copia-e-cola
  - [ ] Expiração configurável (default: 1 hora, máximo: 24 horas)
  - [ ] `GET /charges/:id` retorna status atual (pending, paid, expired, refunded)
  - [ ] Webhook disparado quando cobrança é paga ou expira
  - [ ] Idempotency key para evitar cobranças duplicadas
  - [ ] Valores em centavos (integer), mínimo R$ 1,00

**R-02: API de Customers**
CRUD de clientes com validação de dados brasileiros.
- Acceptance criteria:
  - [ ] `POST /customers` cria customer com name, email, tax_id (CPF ou CNPJ)
  - [ ] CPF validado com algoritmo de dígitos verificadores; CNPJ idem
  - [ ] Email como identificador secundário (unique por account)
  - [ ] `GET /customers/:id` inclui lista de assinaturas e cobranças vinculadas
  - [ ] `DELETE /customers/:id` só funciona se não tem assinatura ativa (retorna erro 409)

**R-03: API de Planos**
Configuração de planos de assinatura com preço fixo e ciclo.
- Acceptance criteria:
  - [ ] `POST /plans` cria plano com name, amount, interval (week, month, year) e trial_days (optional, default 0)
  - [ ] `payment_methods: ['pix']` no MVP; campo preparado para `['pix', 'card', 'boleto']`
  - [ ] Plano pode ser arquivado (soft delete) — novas assinaturas não podem usar, existentes continuam
  - [ ] Plano não pode ser editado após criação (criar novo plano para mudar preço)

**R-04: Subscription Engine com State Machine**
Gerenciamento completo do lifecycle de assinaturas.
- Acceptance criteria:
  - [ ] `POST /subscriptions` cria assinatura vinculada a plan e customer
  - [ ] Estado inicial: `trialing` (se plan tem trial_days > 0) ou `active` (se trial_days = 0, primeira cobrança imediata)
  - [ ] Transições válidas: `trialing → active`, `active → past_due`, `past_due → active` (retry ok), `past_due → canceled` (retries esgotados), `active → canceled` (via API), `active → paused`, `paused → active`
  - [ ] Transições inválidas retornam erro 422 com mensagem clara
  - [ ] `cancel_at_period_end: true` mantém acesso até o fim do ciclo corrente
  - [ ] Cada transição gera evento e dispara webhook
  - [ ] `GET /subscriptions/:id` retorna estado atual, próximo vencimento, histórico de invoices

**R-05: Geração Automática de Cobranças por Ciclo**
No vencimento de cada ciclo, o Fio gera cobrança PIX automaticamente.
- Acceptance criteria:
  - [ ] Job scheduler executa diariamente, identifica assinaturas com vencimento no dia
  - [ ] Para assinaturas com Pix Automático: debita automaticamente via consent
  - [ ] Para assinaturas sem Pix Automático: gera QR code e notifica via webhook
  - [ ] Invoice criada para cada ciclo com referência à assinatura e cobrança
  - [ ] Se assinatura está paused ou canceled, não gera cobrança

**R-06: Pix Automático (Consent Flow)**
Implementação do Pix Automático do Banco Central para cobranças recorrentes automáticas.
- Acceptance criteria:
  - [ ] `POST /subscriptions` com `pix_automatico: true` inicia consent flow
  - [ ] Customer recebe notificação para autorizar no app do banco
  - [ ] Webhook quando consent é aprovado ou negado
  - [ ] Se consent negado, fallback automático para QR code por ciclo
  - [ ] Consent vinculado ao customer (reutilizável entre assinaturas)
  - [ ] Respeita limites do BC: máximo 3 retries em 7 dias

**R-07: Dunning (Retry Inteligente)**
Retry automático quando pagamento falha.
- Acceptance criteria:
  - [ ] Configuração default: retry em D+1, D+3, D+7 após falha
  - [ ] Configurável via API por plano (override do default)
  - [ ] Cada retry gera nova cobrança PIX e webhook `invoice.retry`
  - [ ] Assinatura transita para `past_due` na primeira falha
  - [ ] Se retry sucede, assinatura volta para `active`
  - [ ] Se todos os retries falham, assinatura transita para `canceled`
  - [ ] Webhook `subscription.canceled` inclui motivo `dunning_failed`

**R-08: Webhooks**
Sistema de notificação de eventos para o sistema do dev.
- Acceptance criteria:
  - [ ] `POST /webhook-endpoints` registra URL de destino
  - [ ] Cada evento enviado com assinatura HMAC-SHA256 no header `Fio-Signature`
  - [ ] SDK inclui método `fio.webhooks.verify(payload, signature, secret)` para validação
  - [ ] Retry com backoff exponencial: 1min, 5min, 30min, 2h, 24h (5 tentativas)
  - [ ] Dashboard mostra log de cada delivery (timestamp, status code, response time)
  - [ ] Eventos: `charge.created`, `charge.paid`, `charge.failed`, `charge.expired`, `charge.refunded`, `subscription.created`, `subscription.activated`, `subscription.past_due`, `subscription.canceled`, `subscription.paused`, `subscription.resumed`, `invoice.created`, `invoice.paid`, `invoice.failed`, `customer.created`, `customer.updated`

**R-09: SDK TypeScript**
Client library oficial com tipagem completa.
- Acceptance criteria:
  - [ ] Pacote `@fio-pay/sdk` publicado no npm
  - [ ] Todas as entidades tipadas (Charge, Customer, Plan, Subscription, Invoice, WebhookEvent)
  - [ ] Erros tipados: `FioError` (base), `FioValidationError` (422), `FioAuthError` (401), `FioNotFoundError` (404), `FioRateLimitError` (429)
  - [ ] Método `fio.webhooks.verify()` para validação de assinatura
  - [ ] Exemplo funcional de integração com Next.js no repositório
  - [ ] README com quickstart de 5 minutos
  - [ ] Open source (MIT license)

**R-10: Documentação**
Documentação interativa como produto.
- Acceptance criteria:
  - [ ] Quickstart: "Primeira cobrança em 5 minutos" com código copiável
  - [ ] Guia: "Subscription billing completo em 30 minutos"
  - [ ] API Reference com todos os endpoints, params, responses e exemplos
  - [ ] Página de webhooks com payload de exemplo para cada evento
  - [ ] Sandbox interativo (testar endpoints direto na doc)
  - [ ] OpenAPI spec publicada e versionada
  - [ ] `llms.txt` no root do domínio (para agentes de IA)

**R-11: Dashboard Web**
Interface visual para gerenciar o Fio.
- Acceptance criteria:
  - [ ] Cadastro com email + senha; login com magic link como alternativa
  - [ ] Geração de API keys (live + test), com rotação
  - [ ] Toggle sandbox/live
  - [ ] Listagem paginada de customers, cobranças, assinaturas
  - [ ] Detalhe de cada entidade com timeline de eventos
  - [ ] Painel de métricas: MRR atual (soma dos valores de assinaturas ativas ÷ ciclo), churn rate (últimos 30 dias), total de assinaturas ativas
  - [ ] Log de webhook deliveries com status e response

**R-12: Sandbox**
Ambiente de teste isolado.
- Acceptance criteria:
  - [ ] API keys prefixadas: `fio_test_` (sandbox) e `fio_live_` (produção)
  - [ ] Cobranças de teste geram QR codes funcionais que podem ser "pagos" via API (`POST /test/charges/:id/pay`)
  - [ ] Dunning pode ser acelerado no sandbox (minutos em vez de dias)
  - [ ] Dados de teste isolados dos dados de produção
  - [ ] Webhooks de sandbox apontam para URL configurada separadamente

**R-13: Abstração de PSP**
Camada de abstração que isola o Fio do PSP subjacente.
- Acceptance criteria:
  - [ ] Interface `PaymentProvider` com métodos: `createPixCharge`, `createPixAutomaticoConsent`, `getChargeStatus`, `refund`
  - [ ] Implementação para Efí Pay como PSP primário
  - [ ] Trocar de PSP requer apenas nova implementação da interface, sem alterar core
  - [ ] Credenciais do PSP armazenadas com encryption at rest
  - [ ] Logs de comunicação com PSP para debugging

### Nice-to-Have (P1) — Melhora significativamente, mas lança sem

**R-14: Reembolsos**
Reembolso total e parcial via API.
- Acceptance criteria:
  - [ ] `POST /charges/:id/refund` com amount opcional (parcial) ou sem (total)
  - [ ] Reembolso via Pix cash-out para a chave PIX original
  - [ ] Status da cobrança muda para `refunded` (total) ou `partially_refunded`
  - [ ] Webhook `charge.refunded`

**R-15: Pause/Resume**
Pausar e reativar assinaturas.
- Acceptance criteria:
  - [ ] `POST /subscriptions/:id/pause` transita para `paused`
  - [ ] Assinatura pausada não gera cobranças
  - [ ] `POST /subscriptions/:id/resume` transita de volta para `active`
  - [ ] Próximo vencimento recalculado a partir da data de resume

**R-16: MCP Server**
Servidor MCP para agentes de IA.
- Acceptance criteria:
  - [ ] Tools: `create_charge`, `create_subscription`, `list_subscriptions`, `get_subscription`, `cancel_subscription`
  - [ ] Autenticação via API key
  - [ ] Cada ação logada com: agent_id (ou user-agent), timestamp, tool chamada, input, output
  - [ ] Open source (repositório separado)

### Future Considerations (P2) — Fora de escopo, mas influencia arquitetura

**R-17: Multi-método**
O modelo de dados inclui `payment_method.type` como enum (`pix | card | boleto`) desde o dia 1, mesmo que apenas `pix` seja implementado. Isso evita migração de schema quando cartão e boleto entrarem.

**R-18: Event log para analytics**
Tabela `events` append-only com event_type, entity_type, entity_id, data (JSON), metadata (JSON). Essa estrutura permite calcular MRR, churn, cohort e alimentar AI analytics no futuro sem migração de dados.

**R-19: Multi-tenant**
O modelo de dados usa `account_id` como chave de isolamento em todas as tabelas. Isso prepara para sub-contas (plataformas com sellers) sem reestruturar o banco.

---

## 6. Success Metrics

### Leading indicators (primeiras semanas)

| Métrica | Target (sucesso) | Stretch | Medição |
|---------|------------------|---------|---------|
| Devs com conta criada | 100 em 30 dias | 200 | Dashboard interno |
| Devs que completaram quickstart (≥1 cobrança de teste) | 40% dos cadastrados | 60% | Evento `first_test_charge` |
| Tempo médio até primeira cobrança de teste | < 15 min | < 10 min | Timestamp cadastro → primeira charge no sandbox |
| Taxa de erro na integração | < 5% das requests | < 2% | Logs de API (4xx/5xx) |
| Devs com integração em produção (≥1 cobrança live) | 20 em 60 dias | 40 | Evento `first_live_charge` |

### Lagging indicators (1-3 meses)

| Métrica | Target (sucesso) | Stretch | Medição |
|---------|------------------|---------|---------|
| GMV processado | R$ 100K/mês no mês 3 | R$ 500K/mês | Soma de cobranças pagas |
| MRR do Fio | R$ 5K no mês 3 | R$ 15K | Revenue do Fio (taxas cobradas) |
| NPS | > 60 | > 70 | Survey trimestral |
| Assinaturas ativas gerenciadas | 500 | 2.000 | Contagem de subscriptions `active` |
| Taxa de recuperação por dunning | > 30% das cobranças `failed` | > 50% | Cobranças recuperadas por retry / total de falhas |

### Avaliação

- **Semana 1 pós-launch:** Analisar leading indicators. Corrigir problemas de onboarding.
- **Mês 1:** Avaliar adoção. Se < 50 cadastros, investigar canais de distribuição.
- **Mês 3:** Avaliar lagging indicators. Decidir prioridades da v2.0 com base em dados reais.

---

## 7. Open Questions

| # | Pergunta | Quem responde | Bloqueante? |
|---|---------|--------------|-------------|
| 1 | **Qual conta Efí Pay usar?** MEI do Lucas (Efí Pro) ou PJ dedicada (Efí Empresas)? Afeta taxas e limites. | Lucas / Efí Pay | Sim — precisa da conta para começar integração |
| 2 | **O Pix Automático da Efí exige certificado digital?** Documentação menciona mTLS. Verificar se é obrigatório no sandbox e em produção. | Engenharia / Efí Pay | Sim — afeta setup do ambiente |
| 3 | **Como lidar com o requisito de R$ 5M de patrimônio líquido?** O Fio usa Efí como PSP (participante direto), então o Fio em si não precisa ser participante. Confirmar que esse modelo é regulatoriamente válido. | Legal / BC | Não (assumimos que PSP parceiro resolve) |
| 4 | **Pricing exato do Fio.** Free tier até 50 assinaturas está definido. Qual o % por transação nos tiers pagos? Precisa modelar unit economics com a taxa da Efí por baixo. | Lucas (negócio) | Não (pode lançar com free tier e definir depois) |
| 5 | **Domínio e marca.** `fio.dev`? `fiopay.com`? `usefio.com`? Verificar disponibilidade. | Lucas | Não (mas precisa definir antes do launch) |
| 6 | **Next.js ou outra framework para o dashboard?** Next.js mantém ecossistema unificado com o SDK, mas o dashboard não precisa de SSR pesado. Avaliar se Vite + React é mais leve. | Engenharia | Não |

---

## 8. Timeline e Dependências

### Dependências externas

| Dependência | Impacto | Mitigação |
|-------------|---------|-----------|
| Conta Efí Pay aprovada com acesso à API | Bloqueia toda a integração de pagamentos | Iniciar processo de abertura de conta na semana 1 |
| Pix Automático disponível no sandbox da Efí | Bloqueia implementação de consent flow | Desenvolver com mock; integrar quando disponível |
| Domínio disponível | Bloqueia deploy público e docs | Comprar domínio na semana 1 |

### Fases de entrega (~13 semanas)

**Fase 1 — Core API (semanas 1-4)**
- Modelo de dados (PostgreSQL), API framework (Hono/Fastify), auth
- CRUD de customers, charges, plans
- Integração Efí Pay: Pix Cobrança (QR code)
- Abstração `PaymentProvider`

**Fase 2 — Subscription Engine (semanas 3-6)**
- State machine de subscriptions
- Job scheduler para geração de cobranças por ciclo
- Trial periods
- Sobreposição com Fase 1 é intencional (charges e subscriptions se integram)

**Fase 3 — Dunning + Pix Automático (semanas 5-7)**
- Retry automático com schedule configurável
- Integração Pix Automático (consent flow + cobrança automática)
- Fallback QR code quando consent falha

**Fase 4 — Webhooks + Eventos (semanas 5-7)**
- Sistema de webhooks com HMAC e retry
- Event log append-only
- Executa em paralelo com Fase 3

**Fase 5 — Dashboard (semanas 7-9)**
- Auth (email + magic link)
- API keys, listagens, detalhe com timeline
- Métricas básicas (MRR, churn, ativas)
- Logs de webhooks

**Fase 6 — SDK + Docs (semanas 9-11)**
- SDK TypeScript com tipagem completa
- Documentação: quickstart, guia de subscription, API reference
- Sandbox interativo
- OpenAPI spec + llms.txt

**Fase 7 — MCP + Polish (semanas 11-13)**
- MCP server básico com audit trail
- Sandbox: simulação de pagamento, dunning acelerado
- Dogfooding nos projetos do Lucas
- Teste com segundo dev externo (critério de "pronto")
- Landing page + post no TabNews

### Critérios de "pronto para lançar"

1. Lucas cria plano → assina cliente teste → recebe PIX no sandbox → subscription muda de estado → webhook chega — tudo em < 30 min
2. Um segundo dev faz o mesmo seguindo só a documentação, sem ajuda
3. Dunning funciona end-to-end: falha → retry D+1 → retry D+3 → retry D+7 → cancela
4. Dashboard mostra MRR e assinaturas ativas corretamente
5. MCP server cria cobrança e consulta assinatura via agente

---

## 9. Stack Técnica

| Camada | Tecnologia | Racional |
|--------|-----------|----------|
| API | Node.js + Hono (ou Fastify) | Performance, TypeScript nativo, ecossistema indie dev |
| Banco | PostgreSQL | Confiável, JSONB, event sourcing-friendly |
| Fila | BullMQ (Redis) | Jobs de dunning, retry, webhook delivery |
| Infra | Railway ou Fly.io | Deploy simples, pricing justo para MVP |
| Dashboard | Next.js (ou Vite + React) | Ecossistema unificado com SDK |
| Docs | Mintlify ou Fumadocs | API playground, bonita, fácil de manter |
| MCP Server | TypeScript | Mesmo ecossistema |
| PSP | Efí Pay | Pix Automático + Pix Cobrança + cartão/boleto futuro |

---

## Apêndice A: Modelo de Dados (Simplificado)

```
accounts
├── id, name, email, password_hash
├── api_key_live, api_key_test
└── created_at

customers
├── id, account_id
├── name, email, tax_id, tax_id_type (cpf | cnpj)
├── pix_automatico_consent_id (nullable)
└── created_at, updated_at

plans
├── id, account_id
├── name, amount (centavos), interval (week | month | year)
├── trial_days, payment_methods (json: ['pix'])
├── active (boolean — soft delete)
└── created_at

subscriptions
├── id, account_id, customer_id, plan_id
├── status (trialing | active | past_due | canceled | paused)
├── current_period_start, current_period_end
├── trial_end (nullable)
├── cancel_at_period_end (boolean)
├── canceled_at, paused_at
└── created_at, updated_at

invoices
├── id, account_id, subscription_id, customer_id
├── amount, status (draft | open | paid | failed | void)
├── period_start, period_end
├── paid_at, due_date
└── created_at

charges
├── id, account_id, customer_id, invoice_id (nullable)
├── amount, status (pending | paid | failed | expired | refunded)
├── payment_method_type (pix | card | boleto)
├── pix_qr_code, pix_qr_code_url, pix_copy_paste
├── expires_at, paid_at
├── provider (efi), provider_reference
├── idempotency_key
└── created_at

events
├── id, account_id
├── event_type, entity_type, entity_id
├── data (jsonb — snapshot), metadata (jsonb — agent_id, ip, sdk_version)
├── idempotency_key
└── created_at

webhook_endpoints
├── id, account_id
├── url, secret (hmac key), active
└── created_at

webhook_deliveries
├── id, webhook_endpoint_id, event_id
├── status (pending | delivered | failed)
├── attempts, last_attempt_at
├── response_status_code, response_body (truncated)
└── created_at
```

---

## Apêndice B: API Endpoints (Resumo)

```
Authentication: Bearer token (API key) no header Authorization

POST   /v1/customers                  Criar customer
GET    /v1/customers/:id              Consultar customer
PUT    /v1/customers/:id              Atualizar customer
DELETE /v1/customers/:id              Deletar customer (sem assinatura ativa)
GET    /v1/customers                  Listar customers (paginado)

POST   /v1/plans                      Criar plano
GET    /v1/plans/:id                  Consultar plano
DELETE /v1/plans/:id                  Arquivar plano (soft delete)
GET    /v1/plans                      Listar planos (paginado)

POST   /v1/subscriptions              Criar assinatura
GET    /v1/subscriptions/:id          Consultar assinatura
POST   /v1/subscriptions/:id/cancel   Cancelar assinatura
POST   /v1/subscriptions/:id/pause    Pausar assinatura
POST   /v1/subscriptions/:id/resume   Reativar assinatura
GET    /v1/subscriptions              Listar assinaturas (paginado, filtro por status)

POST   /v1/charges                    Criar cobrança avulsa
GET    /v1/charges/:id                Consultar cobrança
POST   /v1/charges/:id/refund         Reembolsar (total ou parcial)
GET    /v1/charges                    Listar cobranças (paginado)

GET    /v1/invoices/:id               Consultar invoice
GET    /v1/invoices                   Listar invoices (paginado)

POST   /v1/webhook-endpoints          Registrar endpoint
GET    /v1/webhook-endpoints          Listar endpoints
DELETE /v1/webhook-endpoints/:id      Remover endpoint
GET    /v1/webhook-deliveries         Listar deliveries (paginado)

GET    /v1/metrics                    MRR, churn, assinaturas ativas

POST   /v1/test/charges/:id/pay       [Sandbox] Simular pagamento
POST   /v1/test/time/advance          [Sandbox] Avançar tempo (para testar dunning)
```

---

*PRD do Fio v1.0 — Documento vivo. Última atualização: março/2026.*
