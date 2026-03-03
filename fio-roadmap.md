# Fio — Roadmap

> *Documento interno. A versão pública para o site está em `fio-roadmap-public.md`.*

---

## Visão geral das versões

```
v1.0 "Foundation"          v2.0 "Scale"
━━━━━━━━━━━━━━━━━━━━━━━    ━━━━━━━━━━━━━━━━━━━━━━━
PIX-only                   Multi-método
Billing engine completa    Billing avançado
DX de referência           Plataforma
MCP básico                 MCP com governança

~13 semanas                ~12 semanas após v1
```

---

## v1.0 — "Foundation"

**Objetivo:** Lançar a melhor experiência de subscription billing via PIX para indie devs brasileiros. Simples como AbacatePay no dia 1, profundo quando precisar.

**Critério de sucesso:** Lucas rodando billing dos próprios projetos + 1 dev externo integrado seguindo só a documentação.

### Core: Billing Engine

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Cobranças avulsas PIX** | QR code dinâmico, copia-e-cola, expiração configurável | 🔲 |
| **Pix Automático** | Consent flow (autorização do pagador), cobrança automática por ciclo | 🔲 |
| **Pix QR Code (fallback)** | Para clientes cujo banco não suporta Pix Automático ainda | 🔲 |
| **Planos de assinatura** | CRUD de planos (mensal, anual, semanal), valor fixo | 🔲 |
| **Subscription lifecycle** | State machine: `trialing → active → past_due → canceled → paused` | 🔲 |
| **Trial periods** | `trial_days` configurável por plano | 🔲 |
| **Dunning inteligente** | Retry automático D+1, D+3, D+7 (configurável). Cancela após falha final | 🔲 |
| **Cancelamento** | Imediato ou no fim do ciclo corrente (`cancel_at_period_end`) | 🔲 |
| **Pause/Resume** | Pausar assinatura sem cancelar, retomar depois | 🔲 |
| **Reembolsos** | Total e parcial via API | 🔲 |
| **Customers** | CRUD com CPF/CNPJ validado, email, histórico de cobranças | 🔲 |

### Infra: Webhooks & Eventos

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Webhooks** | Registro de endpoint, assinatura HMAC, retry com backoff exponencial | 🔲 |
| **Eventos de lifecycle** | `subscription.created`, `.activated`, `.past_due`, `.canceled`, `.paused`, `.resumed` | 🔲 |
| **Eventos de cobrança** | `charge.created`, `.paid`, `.failed`, `.expired`, `.refunded` | 🔲 |
| **Eventos de invoice** | `invoice.created`, `.paid`, `.failed` | 🔲 |
| **Log de entregas** | Sucesso/falha de cada webhook entregue, visível no dashboard | 🔲 |
| **Event log (append-only)** | Cada mudança de estado gera evento normalizado — base para métricas e auditoria | 🔲 |

### DX: Developer Experience

| Feature | Detalhe | Status |
|---------|---------|--------|
| **API REST** | Endpoints RESTful, JSON, paginação cursor-based, idempotency keys | 🔲 |
| **SDK TypeScript** | `@fio-pay/sdk` — tipagem completa, error handling tipado, open source | 🔲 |
| **Documentação** | Quickstart (5 min), guia de subscription (30 min), API reference completa | 🔲 |
| **Sandbox** | Ambiente de teste com QR codes funcionais, toggle test/live | 🔲 |
| **OpenAPI spec** | Spec publicada, docs auto-geradas | 🔲 |
| **Exemplos** | Integração Next.js completa, exemplos copiáveis em cada endpoint | 🔲 |
| **llms.txt** | Arquivo para agentes de IA entenderem a API | 🔲 |

### Dashboard

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Auth** | Login email + senha, magic link | 🔲 |
| **API keys** | Live key + test key, rotação | 🔲 |
| **Listagens** | Customers, cobranças, assinaturas, invoices | 🔲 |
| **Detalhe** | Timeline de eventos por entidade | 🔲 |
| **Métricas básicas** | MRR atual, churn rate (30d), assinaturas ativas, receita do mês | 🔲 |
| **Logs de webhook** | Status de cada delivery | 🔲 |

### MCP Server (básico)

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Tools** | Criar cobrança, criar assinatura, listar/consultar/cancelar | 🔲 |
| **Auth** | Via API key (mesma do SDK) | 🔲 |
| **Audit trail** | Log de cada ação: agente, timestamp, ação, resultado | 🔲 |
| **Open source** | Publicado no GitHub | 🔲 |

### Integração PSP

| Feature | Detalhe | Status |
|---------|---------|--------|
| **PSP primário** | Efí Pay — Pix Automático + Pix Cobrança | 🔲 |
| **Abstração `PaymentProvider`** | Interface que permite trocar/adicionar PSP sem refatorar core | 🔲 |

---

## v2.0 — "Scale"

**Objetivo:** Expandir para multi-método (cartão, boleto), billing avançado, e funcionalidades de plataforma. O Fio deixa de ser "billing PIX para indie dev" e se torna "a plataforma de billing para SaaS brasileiros".

**Critério de sucesso:** 200+ devs com integração ativa, R$ 5M/mês em GMV, MRR do Fio > R$ 100K.

### Novos métodos de pagamento

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Cartão de crédito** | Cobrança recorrente, tokenização, retry em falha, suporte a 3DS | 🔲 |
| **Boleto bancário** | Emissão registrada, segunda via, conciliação automática | 🔲 |
| **Link de pagamento** | URL compartilhável com checkout hosted (PIX + cartão + boleto) | 🔲 |
| **Checkout hosted** | Página de pagamento white-label do Fio — o dev linka, o cliente paga | 🔲 |
| **Smart retries multi-método** | Falhou no PIX? Tenta cartão. Falhou cartão? Gera boleto. Configurável | 🔲 |

### Billing avançado

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Proration** | Upgrade/downgrade mid-cycle com cálculo proporcional automático | 🔲 |
| **Cupons e descontos** | % ou valor fixo, duração limitada, limite de uso, código público | 🔲 |
| **Usage-based billing** | Metering API, agregação por período, cobrança por uso + base fixa | 🔲 |
| **Múltiplas assinaturas** | Um customer com N assinaturas simultâneas | 🔲 |
| **Add-ons** | Itens avulsos adicionados à invoice da assinatura | 🔲 |
| **Invoices customizáveis** | Template de invoice com logo, dados fiscais, itens detalhados | 🔲 |

### Portal self-service

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Portal embeddable** | Widget/iframe que o dev coloca no app — cliente gerencia assinatura | 🔲 |
| **Ações do cliente** | Ver plano atual, trocar plano, atualizar método de pagamento, cancelar | 🔲 |
| **Histórico** | Invoices anteriores, recibos para download | 🔲 |
| **Customização** | Logo, cores, textos customizáveis pelo dev | 🔲 |

### Plataforma & Marketplace

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Split billing** | Distribuição automática de receita entre plataforma e sellers | 🔲 |
| **Multi-tenant** | Sub-contas com permissões isoladas (plataformas com sellers) | 🔲 |
| **NF-e automática** | Emissão de nota fiscal de serviço integrada ao ciclo de billing | 🔲 |
| **Connect (tipo Stripe Connect)** | Onboarding de sellers via API, KYC delegado | 🔲 |

### MCP avançado & AI

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Approval workflows** | Limites por agente — acima de R$ X, requer aprovação humana | 🔲 |
| **Scoping de permissões** | Agente A: só leitura. Agente B: cobra até R$ 100. Agente C: full access | 🔲 |
| **Rate limiting por agente** | Máximo N operações por hora/dia por agente | 🔲 |
| **Insights AI** | "Seu churn aumentou 15% — os cancelamentos são concentrados no dia 7 do trial. Considere estender para 14 dias." | 🔲 |
| **Dunning AI** | Retry otimizado por ML — aprende o melhor horário/dia para cobrar cada cliente | 🔲 |

### DX expandida

| Feature | Detalhe | Status |
|---------|---------|--------|
| **CLI** | `fio subscriptions list`, `fio charges retry sub_123`, `fio logs tail` | 🔲 |
| **SDK Python** | Segundo SDK oficial, tipagem completa | 🔲 |
| **SDK Go** | Terceiro SDK | 🔲 |
| **Terraform provider** | Infra-as-code para planos, webhooks, config | 🔲 |
| **GitHub Action** | CI/CD para validar config de billing em PR | 🔲 |

### Dashboard avançado

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Métricas avançadas** | Cohort analysis, LTV por plano, MRR breakdown (new, expansion, contraction, churn) | 🔲 |
| **Revenue forecast** | Projeção de receita baseada em tendência | 🔲 |
| **Alertas** | Notificação quando churn sobe, MRR cai, falhas de pagamento aumentam | 🔲 |
| **Multi-user** | Team management, roles (admin, viewer, developer) | 🔲 |
| **Audit log** | Quem fez o quê no dashboard (humano ou agente) | 🔲 |
| **Exportação** | CSV, JSON, API de métricas para BI externo | 🔲 |

### Integração PSP

| Feature | Detalhe | Status |
|---------|---------|--------|
| **Stark Bank** | PSP secundário — participante direto, menor custo em volume | 🔲 |
| **Multi-PSP** | Failover automático: se PSP A cai, redireciona para PSP B | 🔲 |
| **Smart routing** | Roteia para o PSP com menor custo/maior conversão por método | 🔲 |

---

## Timeline visual

```
2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAR    ABR    MAI    JUN    JUL    AGO    SET    OUT    NOV    DEZ

├──────────────────────────┤
       v1.0 "Foundation"
       ~13 semanas

       S1-2: Core API + PSP
       S3-4: Subscription engine
       S5-6: Dunning + webhooks + Pix Automático
       S7-8: Dashboard
       S9-10: SDK + docs
       S11-12: MCP + sandbox + polish
       S13: Launch 🚀

                           ├─────────────────────────────────┤
                                  v2.0 "Scale"
                                  ~12 semanas

                                  S1-3: Cartão + boleto
                                  S4-5: Link de pagamento + checkout
                                  S6-7: Proration + cupons
                                  S8-9: Portal self-service
                                  S10: MCP avançado
                                  S11-12: Split + multi-tenant
                                  Launch v2 🚀
```

---

*Documento vivo — atualizar conforme o desenvolvimento avança.*
