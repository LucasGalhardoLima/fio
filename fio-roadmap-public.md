# Roadmap

O Fio é construído em público. Aqui está o que estamos fazendo e para onde estamos indo.

Se você quer algo que não está aqui, [abre uma issue](https://github.com/fio-pay/fio/issues).

---

## v1.0 — Foundation `em desenvolvimento`

O essencial: subscription billing via PIX que funciona, com DX que respeita seu tempo.

### Billing Engine

- [ ] Cobranças avulsas PIX (QR code + copia-e-cola)
- [ ] Pix Automático (consent + cobrança recorrente automática)
- [ ] Fallback para QR code (bancos sem Pix Automático)
- [ ] Planos de assinatura (mensal, anual, semanal)
- [ ] Subscription lifecycle completo (`trialing → active → past_due → canceled → paused`)
- [ ] Trial periods configuráveis
- [ ] Dunning inteligente (retry D+1, D+3, D+7 — configurável)
- [ ] Cancelamento imediato ou no fim do ciclo
- [ ] Pause e resume de assinatura
- [ ] Reembolsos (total e parcial)
- [ ] Customers com CPF/CNPJ

### Developer Experience

- [ ] API REST com idempotency keys
- [ ] SDK TypeScript (`@fio-pay/sdk`) com tipagem completa
- [ ] Webhooks com assinatura HMAC e retry automático
- [ ] Sandbox com QR codes de teste
- [ ] Documentação interativa com exemplos copiáveis
- [ ] Quickstart: primeira cobrança em 5 minutos
- [ ] OpenAPI spec publicada
- [ ] `llms.txt` para agentes de IA

### Dashboard

- [ ] API keys (live + test)
- [ ] Listagem de customers, cobranças e assinaturas
- [ ] Timeline de eventos por entidade
- [ ] Métricas: MRR, churn rate, assinaturas ativas
- [ ] Logs de webhook delivery

### AI / MCP

- [ ] MCP Server open source
- [ ] Tools: criar cobrança, gerenciar assinaturas, consultar status
- [ ] Audit trail de cada ação por agente

---

## v2.0 — Scale `planejado`

Multi-método, billing avançado, plataforma.

### Novos métodos de pagamento

- [ ] Cartão de crédito (tokenização, retry, 3DS)
- [ ] Boleto bancário (emissão registrada, conciliação automática)
- [ ] Link de pagamento com checkout hosted
- [ ] Smart retries cross-method (PIX falhou → tenta cartão → gera boleto)

### Billing avançado

- [ ] Proration em upgrade/downgrade
- [ ] Cupons e descontos (% ou fixo, com duração e limite)
- [ ] Usage-based billing (metering + cobrança por uso)
- [ ] Múltiplas assinaturas por customer
- [ ] Add-ons em invoices
- [ ] Invoices customizáveis (logo, dados fiscais)

### Portal self-service

- [ ] Widget embeddable para o cliente final
- [ ] Trocar plano, atualizar pagamento, cancelar
- [ ] Histórico de invoices e recibos
- [ ] White-label (logo + cores do dev)

### Plataforma

- [ ] Split billing (plataforma + sellers)
- [ ] Multi-tenant com sub-contas isoladas
- [ ] NF-e automática
- [ ] Connect: onboarding de sellers via API

### MCP avançado

- [ ] Approval workflows (limites por agente)
- [ ] Scoping de permissões granular
- [ ] Rate limiting por agente
- [ ] Insights AI ("seu churn subiu 15% — cancelamentos concentrados no dia 7 do trial")
- [ ] Dunning AI (melhor horário para cobrar cada cliente)

### DX expandida

- [ ] CLI (`fio subscriptions list`, `fio charges retry`)
- [ ] SDK Python
- [ ] SDK Go
- [ ] Terraform provider
- [ ] GitHub Action para validar config de billing em CI

### Dashboard avançado

- [ ] Cohort analysis, LTV por plano, MRR breakdown
- [ ] Revenue forecast
- [ ] Alertas (churn alto, falhas de pagamento)
- [ ] Team management (roles: admin, viewer, developer)
- [ ] Exportação (CSV, JSON, API de métricas)

---

## Princípios

**PIX-first, multi-method ready.** A arquitetura suporta múltiplos métodos desde o dia 1 — lançamos com PIX porque é o que importa agora no Brasil.

**Simples no dia 1, profundo na semana 2.** `fio.charges.create()` funciona em 5 minutos. Subscription engine completa quando você precisar. Sem migração.

**Open source onde faz sentido.** SDKs, MCP server, e ferramentas auxiliares são abertos. O core da engine é o produto.

**Dogfood.** O criador do Fio usa o Fio. Se a API dói, a gente conserta.

---

*Última atualização: março/2026*
