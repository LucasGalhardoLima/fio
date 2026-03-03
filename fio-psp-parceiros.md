# Fio — Análise de PSPs Parceiros

> *Qual infraestrutura de pagamento usar por baixo do Fio?*

---

## O que o Fio precisa do PSP

Antes de comparar, o checklist de requisitos:

- **Pix Automático** (consent flow + cobrança recorrente automática)
- **Pix Cobrança** (QR code dinâmico com valor e vencimento — o fallback)
- **API REST moderna** com boa documentação
- **SDKs** em pelo menos Node.js/TypeScript
- **Webhooks** confiáveis para notificação de pagamento
- **Sandbox** funcional para testes
- **Onboarding rápido** (não levar semanas para abrir conta e ter acesso à API)
- **Custo por transação competitivo** (o Fio precisa de margem)
- **Sem exigência de patrimônio líquido alto** para o Fio como empresa (ou o PSP absorve isso como participante direto)

Requisitos desejáveis:
- Pix cash-out (para reembolsos via API)
- Boleto e cartão via API (para quando o Fio expandir em v1.1)
- White-label (o cliente final não vê o PSP, só o Fio)
- Split de pagamento nativo (para v2)

---

## Comparativo de PSPs

### 1. Stark Bank

**O que é:** Banco digital B2B focado em infraestrutura financeira para empresas de tecnologia. Participante direto do PIX (~10% market share B2B). R$ 600 bilhões em TPV em 2025.

**Pontos fortes:**
- Participante direto do Pix → latência mínima, sem intermediários
- API muito bem documentada, considerada referência no mercado BR
- SDKs em 9 linguagens (Node, Python, Java, PHP, Go, Ruby, Elixir, Clojure, .NET)
- Suporte a Pix Automático com guia técnico detalhado
- Pix cash-in (cobrança) e cash-out (pagamento/reembolso)
- Sandbox funcional
- Rating S&P (credibilidade institucional)
- Webhooks nativos
- Boleto e transferência via API (futuro multi-método)

**Pontos de atenção:**
- Pricing sob consulta — precisa negociar. Não é self-service para abrir conta empresarial
- Focado em empresas maiores (pode ser overbuilt para um MVP)
- Onboarding pode levar dias/semanas (verificação KYC empresarial)

**Custo estimado:** Não divulgado publicamente. Mercado de PSPs pratica R$ 0,50 a R$ 3,00 por transação PIX. Stark Bank provavelmente está na faixa R$ 0,50-1,00 para volumes médios.

**Veredicto:** Melhor opção técnica. API de referência, participante direto, multi-produto. O risco é onboarding lento e pricing não transparente. Ideal se o Fio quer a melhor infraestrutura possível desde o dia 1.

---

### 2. Celcoin

**O que é:** Infraestrutura financeira white-label. Atende 250+ fintechs, 2.700+ empresas médias/grandes, 40.000 pontos de varejo. Participante direto do Pix.

**Pontos fortes:**
- White-label por design — feito para ser a infra invisível por trás de outras fintechs
- Suporte a Pix Automático documentado
- API de cobrança (Pix + Boleto) unificada
- Cobrança recorrente nativa (cel_cash)
- Split de pagamento disponível
- Modelo 100% API, sem dashboard obrigatório
- Atende desde fintechs pequenas até grandes
- A partir de R$ 0,99 por PIX recebido (cel_cash)

**Pontos de atenção:**
- Documentação menos polida que Stark Bank
- SDK limitado (menos linguagens)
- DX não é o foco principal — é infraestrutura B2B
- Onboarding empresarial (KYC, contrato)

**Custo estimado:** A partir de R$ 0,99/tx no cel_cash. Negociável por volume.

**Veredicto:** Excelente para white-label. O Celcoin "some" por trás do Fio — o cliente nunca sabe que existe. Boa opção se o Fio quer controle total da experiência. Menos polido que Stark Bank na DX.

---

### 3. Efí Pay (ex-Gerencianet)

**O que é:** Plataforma de pagamentos com conta digital, PIX, boleto, cartão, links de pagamento. Participante direto do Pix. Uma das primeiras a implementar Pix Automático com guia técnico detalhado.

**Pontos fortes:**
- Pix Automático com documentação técnica detalhada (guia passo a passo para devs)
- Pix + Boleto + Cartão + Link de pagamento via mesma API
- SDKs em PHP, Node, Java, Python, Go, .NET
- Conta PJ e MEI (Efí Pro) — onboarding mais acessível
- Cobrança recorrente via API (valores fixos automatizados)
- Webhooks para recorrência e cobranças
- Sandbox disponível
- Taxas mais transparentes: Pix envio R$ 0,30 (Efí Pro) / R$ 1,00 (Efí Empresas)

**Pontos de atenção:**
- Marca menos "tech" que Stark Bank (herança Gerencianet)
- Interface/dashboard legado em algumas áreas
- API tem algumas inconsistências entre produtos (Pix vs Boleto vs Cartão)
- Pode exigir certificado digital para algumas operações Pix

**Custo estimado:** PIX envio R$ 0,30-1,00. PIX recebimento: taxa variável, sob consulta. Boleto: ~R$ 2,50-3,50.

**Veredicto:** Melhor relação custo-benefício para MVP. Tem tudo que o Fio precisa (Pix Automático, boleto, cartão) em uma única integração, com onboarding acessível para MEI/PJ pequena. A DX não é tão boa quanto Stark Bank, mas funciona.

---

### 4. Transfeera

**O que é:** Plataforma de automação de pagamentos e recebimentos via API. Foco em empresas. Adquirida pela PayRetailers em 2024. Cresceu 89% recentemente.

**Pontos fortes:**
- Suporte a Pix Automático documentado
- API focada em automação de pagamentos
- Suporte via Slack direto com time técnico durante integração
- Pix cash-in e cash-out
- Iniciador de pagamentos (Open Finance)

**Pontos de atenção:**
- Foco mais em cash-out (pagamentos em massa) do que cash-in (cobranças)
- Pricing não é público
- Menos SDKs disponíveis
- Adquirida por empresa estrangeira — pode mudar estratégia

**Custo estimado:** Sob consulta. Posicionamento enterprise.

**Veredicto:** Forte em cash-out/pagamentos. Menos ideal para o caso de uso do Fio (que é primariamente cash-in/cobranças). O suporte via Slack é um diferencial para integração, mas o fit não é perfeito.

---

### 5. Woovi / OpenPix

**O que é:** Plataforma de pagamentos PIX com foco em open source e developer experience. Posicionamento próximo ao público indie dev.

**Pontos fortes:**
- Open source friendly (SDKs abertos, bounty program)
- SDKs em React, PHP, Java, Python, Node.js
- Sandbox para desenvolvimento
- Cobranças recorrentes automáticas
- Split de pagamento para marketplaces
- Cashback nativo
- Pricing transparente: 0,8% por transação (mín R$ 0,50, máx R$ 5,00)

**Pontos de atenção:**
- Menos estabelecido que Stark Bank ou Celcoin
- Suporte a Pix Automático não confirmado publicamente
- Foco em Pix (sem boleto/cartão via API)
- Empresa menor — risco de continuidade

**Custo estimado:** 0,8% por transação (mín R$ 0,50, máx R$ 5,00).

**Veredicto:** Cultura alinhada com o Fio (open source, dev-first), pricing transparente. Mas é o mais arriscado em termos de maturidade e cobertura. Bom como opção secundária ou para prototipar rápido.

---

## Matriz de decisão

| Critério (peso) | Stark Bank | Celcoin | Efí Pay | Transfeera | Woovi |
|------------------|-----------|---------|---------|------------|-------|
| **Pix Automático** (crítico) | ✅ Sim | ✅ Sim | ✅ Sim, docs detalhados | ✅ Sim | ❓ Incerto |
| **Pix Cobrança (QR)** (crítico) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **API quality / DX** (alto) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **SDKs Node/TS** (alto) | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **Sandbox** (alto) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **White-label** (médio) | Parcial | ✅ Nativo | Parcial | Parcial | Parcial |
| **Multi-método (futuro)** (médio) | Boleto, TED | Boleto, Pix | Boleto, Cartão, Link | Pix, TED | Só Pix |
| **Onboarding rápido** (alto) | ⭐⭐ Lento | ⭐⭐⭐ | ⭐⭐⭐⭐ MEI ok | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Custo por tx** (alto) | ~R$ 0,50-1,00? | ~R$ 0,99 | ~R$ 0,30-1,00 | Sob consulta | 0,8% (R$ 0,50-5,00) |
| **Confiabilidade/escala** (alto) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Split pagamento** (futuro) | Parcial | ✅ | Parcial | Parcial | ✅ |
| **Cash-out/reembolso** (médio) | ✅ | ✅ | ✅ | ✅ Forte | ✅ |

---

## Recomendação

### Para o MVP: **Efí Pay**

**Por quê:**

1. **Tem tudo que o MVP precisa em um lugar.** Pix Automático (com docs técnicos detalhados), Pix Cobrança, webhooks, sandbox, SDKs. Quando o Fio expandir para cartão e boleto em v1.1, já está na mesma integração — sem trocar de PSP.

2. **Onboarding acessível.** Aceita MEI e PJ pequena. Não precisa de processo enterprise para começar. Isso é crítico para um MVP onde o Lucas precisa ter a API funcionando em dias, não semanas.

3. **Custo competitivo.** R$ 0,30-1,00 por transação PIX dá margem suficiente para o Fio cobrar e ainda ter unit economics saudável.

4. **Pix Automático com guia técnico pronto.** A Efí publicou documentação step-by-step para implementar Pix Automático — isso reduz tempo de integração significativamente.

5. **Multi-método no mesmo PSP.** Quando o Fio adicionar cartão e boleto, não precisa integrar outro PSP. Mesma conta, mesma API, mesmos webhooks.

### Para escala (v2+): **Stark Bank**

Quando o Fio crescer e volume justificar, migrar ou adicionar Stark Bank como PSP secundário. Motivos: participante direto (menores taxas em volume), API de referência, infra mais robusta, credibilidade institucional. A arquitetura do Fio deve abstrair o PSP desde o dia 1 — trocar de Efí para Stark Bank deve ser mudar uma config, não refatorar código.

### Alternativa para prototipar rápido: **Woovi/OpenPix**

Se o Lucas quiser prototipar a API do Fio antes de ter conta em PSP enterprise, o Woovi tem onboarding rápido, pricing transparente e cultura alinhada. Risco: incerteza sobre Pix Automático e menos multi-método. Bom para testar a tese, não para produção final.

---

## Arquitetura: PSP como plugin

O Fio não deve "casar" com um PSP. A camada de abstração é o valor:

```typescript
// O dev nunca vê o PSP
const charge = await fio.charges.create({
  amount: 4990,
  payment_method: 'pix',
  customer: 'cus_123'
})

// Por baixo, o Fio decide qual PSP usar
// provider-adapter/efi.ts → chama API da Efí
// provider-adapter/starkbank.ts → chama API do Stark Bank
// provider-adapter/woovi.ts → chama API do Woovi

interface PaymentProvider {
  createPixCharge(params: PixChargeParams): Promise<PixCharge>
  createPixAutomaticoConsent(params: ConsentParams): Promise<Consent>
  getChargeStatus(id: string): Promise<ChargeStatus>
  refund(id: string, amount?: number): Promise<Refund>
  // ... futuro: createBoletoCharge, createCardCharge
}
```

Isso permite: começar com Efí no MVP, adicionar Stark Bank para volume, e até oferecer multi-PSP (failover automático se um cair).

---

## Próximos passos

1. **Criar conta Efí Pay** (Efí Empresas ou Efí Pro) e obter acesso à API sandbox
2. **Testar Pix Automático** no sandbox — validar consent flow e cobrança recorrente
3. **Testar Pix Cobrança** — gerar QR code, receber webhook de pagamento
4. **Desenhar a interface `PaymentProvider`** — abstração que permite trocar PSP sem tocar no core

---

*Análise gerada em março/2026 com base em dados públicos. Preços são estimativas — confirmar diretamente com cada PSP.*
