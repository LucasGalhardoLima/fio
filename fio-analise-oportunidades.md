# Fio — Análise de Oportunidades e Estratégia de Produto

> *O Stripe Billing para PIX — sem a burocracia dos gateways tradicionais e com suporte nativo a agentes de IA.*

---

## 1. O Mercado: Por Que Agora

### O timing é excepcional

O Pix Automático foi lançado oficialmente em **16 de junho de 2025** pelo Banco Central. Pela primeira vez, o Brasil tem uma infraestrutura nativa de pagamento recorrente instantâneo — e o mercado ainda está se organizando para capturar essa oportunidade.

**Números que importam:**

- **175 milhões** de usuários PIX (160M PF, 16M PJ)
- **R$ 1,66 trilhão** transacionados via PIX só em setembro/2025 (recorde)
- **USD 30 bilhões** em pagamentos recorrentes online que o Pix Automático pode capturar em dois anos (projeção PCMI/EBANX)
- **60 milhões** de brasileiros sem cartão de crédito — mercado que nunca pôde assinar serviços recorrentes
- PIX representa apenas **13%** do volume online em SaaS; cartão de crédito domina com 86%
- Pagamentos recorrentes por cartão cresceram **89% em dois anos** (Abecs) — a demanda existe, o PIX agora compete por ela

### O mercado SaaS brasileiro é grande e está crescendo

- Mercado SaaS Brasil: **USD 7,9 bilhões** em 2025, projetado para **USD 25,5 bilhões** em 2034 (CAGR 13,87%)
- **519 empresas SaaS** mapeadas no Brasil (fev/2026), com **28,2M clientes** combinados
- ~40% das startups brasileiras usam modelo SaaS, a maioria vendendo B2B
- ~200 novas startups lançadas por ano nos últimos 10 anos

**A tese:** O Pix Automático cria uma janela de oportunidade similar à que o Stripe capturou com cartão de crédito nos EUA — mas no contexto de pagamentos instantâneos no Brasil. Quem construir a melhor developer experience para billing via PIX agora vai definir o padrão.

---

## 2. Mapa Competitivo

### Players existentes e como se posicionam

| Player | Foco | Billing Engine | DX (Developer Experience) | PIX Automático | MCP / IA |
|--------|------|---------------|---------------------------|----------------|----------|
| **Vindi** | Hub de pagamentos para recorrência | Sim, completo | API com 30+ integrações, mas documentação intermediária | Sim | Não |
| **Asaas** | Plataforma financeira para PMEs | Sim, com cobrança recorrente | API developer-friendly, sem mensalidade | Sim | Não |
| **Pagar.me** | Gateway de pagamentos (Stone) | Parcial | Reconhecido como melhor documentação de API do BR | Em adoção | Não |
| **Stripe** | Plataforma global de pagamentos | Billing completo | Referência mundial em DX | Sim (via EBANX) | MCP Server global |
| **Iugu** | Plataforma de cobranças | Sim | API razoável | Em adoção | Não |
| **PagBrasil** | Pagamentos para e-commerce | Parcial | API com guia de integração Pix Automático | Sim, early adopter | Não |

### Gaps que o Fio pode explorar

1. **Ninguém é "billing-first" para PIX.** Vindi e Asaas são plataformas financeiras amplas que adicionaram PIX como mais um método. Nenhum deles nasceu como uma subscription engine nativa para PIX.

2. **Developer experience é mediana em todos.** Pagar.me é elogiado pela documentação, mas nenhum player brasileiro tem a experiência Stripe-like de "5 minutos para a primeira cobrança". SDKs são limitados, sandboxes são precários.

3. **Zero suporte a agentes de IA.** Nenhum player brasileiro oferece MCP server ou interface programática pensada para agentes autônomos. O Stripe lançou MCP globalmente; no Brasil, esse espaço está vazio.

4. **State machine de subscription é simplificada.** A maioria trata recorrência como "gerar uma nova cobrança todo mês". Poucos têm máquina de estados completa com trials, dunning inteligente, grace periods, proration.

---

## 3. Posicionamento e Diferenciação

### O framework de posicionamento

```
Para [desenvolvedores e startups SaaS brasileiros]
Que [precisam cobrar assinaturas via PIX sem lidar com a complexidade dos gateways]
O Fio é [uma API de subscription billing nativa para PIX]
Que [entrega uma subscription engine completa com DX de referência e suporte a agentes de IA]
Diferente de [Vindi, Asaas e Pagar.me]
O Fio [foi construído do zero para PIX recorrente, com state machine completa e MCP server nativo]
```

### Os 3 pilares de diferenciação

**Pilar 1: PIX-native billing engine**
Não é PIX adaptado sobre uma plataforma de cartão. É uma engine construída do zero para as particularidades do PIX: liquidação instantânea, QR code lifecycle, Pix Automático com consent management, retry que respeita a dinâmica do PIX (não do cartão).

**Pilar 2: Developer experience de referência**
- Primeira cobrança em < 5 minutos
- SDK em TypeScript/Python com types completos
- Dashboard de teste com sandbox real (QR codes funcionais)
- Documentação como produto (interactive docs, exemplos copiáveis)
- CLI para debugging e operações (`fio subscriptions list`, `fio charges retry`)

**Pilar 3: AI-native desde o dia zero**
- MCP server que permite agentes (Claude, GPT, etc.) executar cobranças com auditoria
- Cada ação do agente gera um audit trail imutável
- Rate limiting e approval workflows configuráveis por agente
- Primeiro billing system no Brasil pensado para o paradigma agentic

---

## 4. Oportunidades Prioritárias

### Oportunidade #1: O dev solo e a micro-SaaS brasileira
**Tamanho:** Centenas de devs solo lançando micro-SaaS no Brasil (comunidades como TabNews, dev.to/br, IndieHackers BR). Precisam de billing que "simplesmente funcione" sem contratar equipe financeira.
**Dor:** Integrar recorrência com Asaas/Vindi requer lidar com webhooks manuais, estados inconsistentes, e conciliação manual.
**Proposta do Fio:** `fio.subscriptions.create()` → pronto. A subscription engine cuida de todo o lifecycle.

### Oportunidade #2: SaaS B2B que quer oferecer PIX como opção
**Tamanho:** 519 empresas SaaS mapeadas, maioria cobrando só cartão. 60M de brasileiros sem cartão = clientes que não convertem.
**Dor:** Adicionar PIX recorrente com os players atuais exige refatorar o fluxo de billing inteiro.
**Proposta do Fio:** Drop-in billing engine. Migra em horas, não semanas.

### Oportunidade #3: Agentic commerce no Brasil
**Tamanho:** Emergente. Stripe já atende 78% do Forbes AI 50. GoCardless, Alipay e Worldpay lançaram MCP servers em 2025-2026. No Brasil, o espaço está vazio.
**Dor:** Agentes de IA que precisam cobrar clientes brasileiros não têm interface programática auditável.
**Proposta do Fio:** O único MCP server de billing para PIX. Agentes cobram, o Fio audita.

### Oportunidade #4: Plataformas e marketplaces
**Tamanho:** Marketplaces, plataformas de educação, healthtechs — qualquer vertical que faça split de pagamentos recorrentes.
**Dor:** Complexidade de distribuição de receita entre plataforma e sellers, com conciliação PIX.
**Proposta do Fio:** Billing com split nativo e dashboard por seller.

---

## 5. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| **Stripe adiciona Pix Automático nativo no Billing** | Alta | Fio precisa ter DX superior no contexto brasileiro (CNPJ, NF-e, idioma, suporte) e ser mais rápido em features PIX-specific. Stripe historicamente demora para localizar profundamente. |
| **Vindi/Asaas melhoram DX significativamente** | Média | Manter velocidade de iteração. A vantagem de nascer billing-first vs. adaptar plataforma existente é real. Focar em developer love como moat. |
| **Regulação do BC muda regras do jogo** | Média | Monitorar de perto. A exigência de R$ 5M de patrimônio líquido para participantes PIX pode ser barreira — Fio precisa usar um PSP parceiro licenciado por baixo. |
| **Adoção de Pix Automático pelo consumidor é lenta** | Média | Fio funciona tanto com Pix Automático (consent-based) quanto com PIX cobranças tradicionais (QR code no vencimento). Não depende 100% do Automático. |
| **Concentração em PIX limita mercado** | Baixa | PIX é 80%+ dos pagamentos instantâneos no Brasil. A tendência é de crescimento, não contração. No futuro, Fio pode expandir para boleto e cartão. |
| **MCP/IA é hype e não gera receita real** | Baixa-Média | Não fazer do MCP o produto principal, mas sim um diferencial. O core é a billing engine. MCP é o que torna Fio futuro-proof e gera awareness. |

---

## 6. Estratégia de Produto

### Segmentos-alvo (em ordem de prioridade)

1. **Devs solo e micro-SaaS** (0-10 clientes) — Volume alto, ticket baixo, mas viral. São os que escrevem sobre ferramentas no Twitter/TabNews.
2. **Startups SaaS early-stage** (10-1000 clientes) — Precisam de billing robusto mas não têm equipe para construir.
3. **SaaS em crescimento** (1000+ clientes) — Querem migrar de cartão para PIX ou oferecer ambos. Revenue real.
4. **Plataformas e marketplaces** — Split billing. Ticket mais alto, ciclo de venda mais longo.

### Modelo de pricing sugerido

```
Free tier:
- Até 50 assinaturas ativas
- API completa + sandbox
- Dashboard básico
- Sem taxa fixa, só % por transação

Growth:
- Assinaturas ilimitadas
- Webhooks avançados + retry customizável
- Portal self-service para cliente final
- Métricas (MRR, churn, LTV)
- R$ X/mês + % por transação (menor que no free)

Scale:
- Tudo do Growth
- MCP server (agentes de IA)
- Split billing
- Ambiente multi-tenant
- SLA de uptime
- Suporte prioritário

Enterprise:
- On-prem / VPC dedicada
- Compliance customizado
- Account manager
```

**Racional:** Começar com free tier generoso (como Stripe) para capturar devs. A monetização vem do % por transação — quanto mais o dev cresce, mais o Fio ganha. Alinha incentivos.

### Roadmap sugerido (3 fases)

**Fase 1 — Foundation (Meses 1-4)**
- [ ] Core subscription engine (criar plano, criar assinatura, gerar cobrança)
- [ ] Integração com PSP parceiro (ex: Stark Bank, Celcoin, ou similar)
- [ ] API REST + SDK TypeScript
- [ ] Pix Automático: consent flow + cobrança automática
- [ ] PIX QR Code: fallback para clientes sem Pix Automático
- [ ] Webhooks de lifecycle (created, paid, failed, canceled)
- [ ] Dashboard web básico
- [ ] Sandbox com QR codes de teste

**Fase 2 — DX & Growth (Meses 4-8)**
- [ ] SDK Python + Go
- [ ] CLI (`fio`) para operações e debugging
- [ ] Dunning inteligente (retry D+1, D+3, D+7 configurável)
- [ ] Portal self-service (cliente final gerencia assinatura)
- [ ] Métricas em tempo real (MRR, churn, cohort)
- [ ] Documentação interativa (API playground)
- [ ] Trial periods e grace periods
- [ ] Proration em upgrades/downgrades

**Fase 3 — AI & Scale (Meses 8-12)**
- [ ] MCP server para agentes de IA
- [ ] Audit trail completo por agente
- [ ] Split billing (marketplaces)
- [ ] Multi-tenant (plataformas)
- [ ] API de métricas (para BI externo)
- [ ] Integração com NF-e (emissão automática de nota)
- [ ] Billing por uso (usage-based) além de recorrência fixa

### Go-to-market

**Canal primário: Developer community**
- Landing page com `curl` de exemplo que funciona em 30 segundos
- Blog técnico com artigos como "Como migrar de Asaas para Fio em 1 hora"
- Open source de libs auxiliares (validação de PIX, cálculo de proration)
- Presença em TabNews, dev.to, Twitter/X dev brasileiro
- YouTube com walkthroughs de integração

**Canal secundário: Content marketing**
- "State of PIX Recorrente" — relatório anual com dados
- Benchmark: "PIX vs Cartão para SaaS: qual converte mais?"
- Newsletter sobre economia recorrente no Brasil

**Canal terciário: Parcerias**
- Integração nativa com Vercel, Railway, Supabase (onde devs BR deployam)
- Partnership com aceleradoras (Y Combinator BR, Endeavor, Cubo)
- Bounty program para primeiras integrações

---

## 7. Métricas de Sucesso (Primeiros 12 Meses)

| Métrica | Meta 6 meses | Meta 12 meses |
|---------|-------------|---------------|
| Devs com conta criada | 500 | 2.000 |
| Devs com integração ativa (>1 cobrança) | 50 | 200 |
| Volume processado (GMV) | R$ 500K/mês | R$ 5M/mês |
| MRR do Fio (receita própria) | R$ 15K | R$ 100K |
| NPS de devs | >60 | >70 |
| Tempo médio para 1ª cobrança | <15 min | <10 min |

---

## 8. Perguntas Abertas para Validar

Antes de construir, vale investigar:

1. **Qual PSP parceiro usar?** Stark Bank, Celcoin, Transfeera, ou integração direta com banco? Cada um tem tradeoffs de custo, cobertura de Pix Automático e velocidade de onboarding.

2. **Devs brasileiros pagariam por DX superior?** Ou o mercado é muito sensível a preço e vai sempre para o Asaas (mais barato)? Validar com entrevistas.

3. **O demand real por MCP/agentes existe hoje?** Ou é mais narrativa de posicionamento para se diferenciar (e capturar atenção) enquanto o revenue vem do billing tradicional?

4. **Como lidar com compliance?** Fio vai precisar de um CNPJ com 6+ meses para oferecer Pix Automático. E o requisito de R$ 5M de patrimônio líquido afeta a arquitetura (PSP parceiro resolve isso?).

5. **Qual vertical atacar primeiro?** Micro-SaaS é viral mas low-revenue. SaaS em crescimento paga mais mas é harder to reach. Validar qual segmento tem mais pull.

---

## 9. Síntese Final

O Fio está posicionado em uma interseção rara de timing de mercado:

- **Infraestrutura nova** (Pix Automático recém-lançado, mercado se reorganizando)
- **Gap de DX** (nenhum player brasileiro tem experiência Stripe-like para PIX billing)
- **Megatrend de IA** (agentic payments é a próxima fronteira, e o Brasil não tem nenhum MCP de billing)
- **Mercado endereçável grande** (USD 30B em recorrência PIX projetados, 519+ SaaS no Brasil)

A aposta central é que developer experience excepcional + billing engine nativa para PIX + AI-readiness cria um produto que não tem equivalente direto no Brasil hoje. O risco principal é execução — construir rápido o suficiente antes que Stripe localize ou que Vindi/Asaas melhorem suas APIs.

O caminho mais inteligente: lançar a Fase 1 com foco obsessivo em DX, capturar early adopters via community, e usar o MCP como diferencial de narrativa que atrai atenção enquanto a billing engine gera revenue real.

---

*Análise gerada em março de 2026. Dados de mercado baseados em fontes públicas.*
