// The landing page in each language it is published in. English is the source; the app
// screens behind "Open app" stay in English for now.

export const LANGS = ["en", "es", "pt"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_PATH: Record<Lang, string> = { en: "/", es: "/es", pt: "/pt" };
export const LANG_NAME: Record<Lang, string> = { en: "English", es: "Español", pt: "Português" };

type Pair = [title: string, text: string];

export interface LandingCopy {
  metaTitle: string;
  metaDescription: string;
  betaNote: string;
  homeLabel: string;
  openApp: string;
  headline: string;
  lead: string;
  startTrade: string;
  howItWorks: string;
  figureSection: string;
  earlyTitle: string;
  earlyText: string;
  problemTitle: string;
  problem: [string, string];
  stepsTitle: string;
  steps: Pair[];
  rulesTitle: string;
  rulesIntro: [before: string, link: string];
  rules: Pair[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  builtTitle: string;
  builtStellar: string;
  builtUsdc: string;
  builtOz: string;
  builtEvent: string;
  footerBy: string;
  footerSource: string;
  footerBeta: string;
  footerStellar: string;
  footerMarks: string;
  stats: {
    live: string;
    reading: string;
    unreachable: string;
    trades: string;
    pool: string;
    harvestFee: string;
    advanceCost: string;
    explorer: string;
  };
  figure: {
    title: string;
    hint: string;
    readout: string;
    coins: string;
    seal: string;
    caption: (price: string, advance: string, repaid: string) => string;
    steps: (price: string, advance: string, repaid: string) => string[];
    paused: string;
    playing: string;
  };
}

const en: LandingCopy = {
  metaTitle: "Avocate Harvest Escrow: farmers paid in seconds",
  metaDescription:
    "USDC escrow on Stellar for farm trade. The farmer is paid in seconds once delivery is checked, and can get an advance from a financing pool.",
  betaNote: "Beta on the Stellar test network. Test USDC only: no real money moves on this site.",
  homeLabel: "Avocate Harvest Escrow, home",
  openApp: "Open app",
  headline: "Farmers paid in seconds. Buyers pay only for what arrives.",
  lead: "The buyer locks the price in USDC on Stellar. An independent validator checks the delivery, and the money reaches the farmer the moment it is confirmed. A financing pool can pay part of it even earlier.",
  startTrade: "Start a trade",
  howItWorks: "How it works",
  figureSection: "The machine and the live numbers",
  earlyTitle: "Paid early, if needed",
  earlyText:
    "While the money is locked, an onboarded farmer can draw up to 80% of the price from a pool funded by several depositors. They earn up to 2% on it; the farmer signs first and the buyer completes the request.",
  problemTitle: "The problem",
  problem: [
    "A farmer who sells a harvest abroad usually ships first and gets paid later. The money can take weeks to arrive, and a cross-border transfer adds fees and intermediaries. Small producers rarely have credit to cover the wait.",
    "The buyer has the opposite worry: paying before the goods arrive means trusting a seller they may never have met. When nobody wants to move first, deals get slower and more expensive, or never happen.",
  ],
  stepsTitle: "How a trade runs",
  steps: [
    ["The buyer locks the price", "The trade gets its own contract on Stellar. The buyer deposits the price in USDC plus a 1% fee; nobody can change the amount or the recipient afterwards."],
    ["The farmer can get paid early", "While the money is locked, an onboarded farmer can ask the financing pool for up to 80% of the price. The farmer signs first and sends the request to the buyer, who completes it."],
    ["An independent validator checks the delivery", "The validator records one verdict on chain with the fingerprint of the inspection report. It can never be rewritten."],
    ["The farmer is paid in seconds", "With a conforming delivery the buyer, or a limited agent acting for them, releases the payment. The pool is repaid first if it advanced money, and the farmer gets the rest."],
    ["Or the buyer gets the money back", "If the delivery is rejected, the buyer gets everything back in one click, fee included. A trade that reaches its deadline also comes back to the buyer, after the pool is repaid."],
  ],
  rulesTitle: "Rules that make cheating pointless",
  rulesIntro: ["Every rule is enforced by the contracts and listed in the ", "project README"],
  rules: [
    ["Only Avocate trades", "A trade counts only if the platform's registry created it. The pool and the app refuse look-alike contracts."],
    ["Collusion gains nothing", "If a financed trade lapses at its deadline, the pool is repaid first, so a buyer and a farmer cannot split an advance by letting the trade expire."],
    ["Real disputes are shared", "When the independent validator rejects a delivery, the buyer is refunded in full and depositors share the loss in proportion to their shares."],
    ["Fair to depositors", "Yield accrues for the time each advance is used, and the pool takes no new deposits while an advance is overdue, so nobody can time an entry or an exit to take value from others."],
    ["A bounded agent", "The agent can only trigger the payout fixed when the trade was created, and only after a conforming validation."],
  ],
  faqTitle: "Questions",
  faq: [
    {
      q: "What is Avocate Harvest Escrow?",
      a: "A USDC escrow on the Stellar network for agricultural trade. Each trade between a buyer and a farmer gets its own smart contract that holds the price until the delivery is checked, then pays the farmer in seconds.",
    },
    {
      q: "How does the farmer get paid?",
      a: "The buyer locks the price in the trade's contract. Once an independent validator confirms the delivery, the buyer, or a limited agent acting for them, releases the payment and the farmer receives it in USDC within seconds.",
    },
    {
      q: "What happens if the delivery is wrong or never arrives?",
      a: "If the validator rejects the delivery, the buyer can take the whole deposit back, fee included. If the trade simply reaches its deadline without being settled, the buyer can also take the money back.",
    },
    {
      q: "How does an advance work, and what does it cost?",
      a: "While a trade is funded, a farmer onboarded by Avocate can ask a financing pool for up to 80% of the price. The farmer signs first and the buyer completes the request. When the trade settles, the pool is repaid the advance plus up to 2% for its depositors, in proportion to the time used, and Avocate charges 0.5% of the advance.",
    },
    {
      q: "What stops a buyer and a farmer from teaming up against the pool?",
      a: "If a financed trade lapses at its deadline, the pool is repaid first and the buyer only gets the rest, so letting a trade expire gains them nothing. Only a rejection by the independent validator refunds the buyer in full, and that loss is shared by all depositors.",
    },
    {
      q: "Who can move the money?",
      a: "Only the trade's own rules. The buyer can pay or, under the conditions above, take a refund. The agent can only trigger the payout agreed when the trade was created, after a conforming validation. Avocate's admin sets fees for new trades but cannot touch the money held in a trade.",
    },
    {
      q: "Is this real money?",
      a: "No. This is a beta running on the Stellar test network with test USDC. Nothing on this site moves real funds.",
    },
  ],
  builtTitle: "Built on",
  builtStellar: "Soroban smart contracts",
  builtUsdc: "Settled in USDC",
  builtOz: "Follows OpenZeppelin security patterns",
  builtEvent: "Built during HackMeridian 2026, Lisbon.",
  footerBy: "by",
  footerSource: "Source code",
  footerBeta: "Beta on Stellar testnet, no real money.",
  footerStellar:
    "This is independent software, not affiliated with, sponsored or endorsed by the Stellar Development Foundation. Stellar is a trademark of the Stellar Development Foundation, all rights reserved.",
  footerMarks:
    "USDC™ is a trademark of Circle Internet Group, Inc. and/or its affiliates. OpenZeppelin is a trademark of its owner. All trademarks shown are the property of their respective owners; their use does not imply endorsement.",
  stats: {
    live: "Live on Stellar",
    reading: "Read from the contracts",
    unreachable: "Network unreachable",
    trades: "trades created on the platform",
    pool: "Financing pool",
    harvestFee: "Harvest fee (buyer)",
    advanceCost: "Advance cost (farmer)",
    explorer: "See the platform contract on the explorer ↗",
  },
  figure: {
    title: "One harvest, one escrow",
    hint: "Click to pause",
    readout: "Validator: delivery conforms",
    coins: "USDC coins",
    seal: "The validator's seal",
    caption: (price, advance, repaid) =>
      `Money moves along the back, goods along the front. The buyer locks ${price} USDC in the vault and the pool advances ${advance} USDC to the farmer while the crate leaves the orchard. The crate is weighed and sealed by the validator, then the vault repays the pool ${repaid} USDC (the advance plus 2%) and pays the farmer the rest.`,
    steps: (price, advance, repaid) => [
      `Buyer locks ${price} USDC`,
      "Crate leaves the orchard",
      `Pool advances ${advance} USDC to the farmer`,
      "Crate weighed at the scale",
      "Validator: delivery conforms",
      `Vault pays: pool repaid ${repaid} USDC, farmer receives the rest`,
      "Goods delivered. Ready for the next trade",
    ],
    paused: "Animation paused. Press to play the trade again.",
    playing: "Animation playing. Press to pause it.",
  },
};

const es: LandingCopy = {
  metaTitle: "Avocate Harvest Escrow: el agricultor cobra en segundos",
  metaDescription:
    "Escrow en USDC sobre Stellar para el comercio agrícola. El agricultor cobra en segundos cuando se confirma la entrega y puede recibir un anticipo de un pool de financiación.",
  betaNote: "Beta en la red de pruebas de Stellar. Solo USDC de prueba: en esta web no se mueve dinero real.",
  homeLabel: "Avocate Harvest Escrow, inicio",
  openApp: "Abrir app",
  headline: "El agricultor cobra en segundos. El comprador solo paga lo que llega.",
  lead: "El comprador bloquea el precio en USDC sobre Stellar. Un validador independiente revisa la entrega y el dinero llega al agricultor en cuanto se confirma. Un pool de financiación puede adelantarle una parte incluso antes.",
  startTrade: "Empezar una operación",
  howItWorks: "Cómo funciona",
  figureSection: "La máquina y las cifras en vivo",
  earlyTitle: "Cobrar antes, si hace falta",
  earlyText:
    "Mientras el dinero está bloqueado, un agricultor dado de alta puede pedir hasta el 80% del precio a un pool aportado por varios inversores, que ganan hasta un 2%. El agricultor firma primero y el comprador completa la petición.",
  problemTitle: "El problema",
  problem: [
    "Un agricultor que vende su cosecha en el extranjero suele enviar primero y cobrar después. El dinero puede tardar semanas en llegar, y la transferencia internacional suma comisiones e intermediarios. El pequeño productor rara vez tiene crédito para aguantar la espera.",
    "Al comprador le preocupa lo contrario: pagar antes de recibir la mercancía obliga a fiarse de un vendedor al que quizá nunca ha visto. Cuando nadie quiere dar el primer paso, las operaciones se encarecen, se retrasan o no llegan a hacerse.",
  ],
  stepsTitle: "Cómo va una operación",
  steps: [
    ["El comprador bloquea el precio", "Cada operación tiene su propio contrato en Stellar. El comprador deposita el precio en USDC más una comisión del 1%; después nadie puede cambiar el importe ni el destinatario."],
    ["El agricultor puede cobrar antes", "Con el dinero bloqueado, un agricultor dado de alta puede pedir al pool de financiación hasta el 80% del precio. Firma primero y envía la petición al comprador, que la completa."],
    ["Un validador independiente revisa la entrega", "El validador registra un único veredicto en la cadena, con la huella del informe de inspección. No se puede reescribir."],
    ["El agricultor cobra en segundos", "Si la entrega es conforme, el comprador, o un agente con permisos limitados que actúa por él, libera el pago. Si el pool adelantó dinero, cobra primero, y el agricultor recibe el resto."],
    ["O el comprador recupera su dinero", "Si la entrega se rechaza, el comprador lo recupera todo con un clic, comisión incluida. Una operación que llega a su plazo también vuelve al comprador, una vez repagado el pool."],
  ],
  rulesTitle: "Reglas que quitan el sentido a hacer trampa",
  rulesIntro: ["Los contratos aplican cada regla, y todas están en el ", "README del proyecto"],
  rules: [
    ["Solo operaciones de Avocate", "Una operación solo cuenta si la creó el registro de la plataforma. El pool y la app rechazan contratos que la imiten."],
    ["Ponerse de acuerdo no sale a cuenta", "Si una operación financiada llega a su plazo, el pool cobra primero, así que comprador y agricultor no pueden repartirse un anticipo dejándola caducar."],
    ["Las disputas reales se reparten", "Cuando el validador independiente rechaza una entrega, el comprador recupera todo y los inversores asumen la pérdida en proporción a sus participaciones."],
    ["Justo con los inversores", "El rendimiento se cobra por el tiempo que se usa cada anticipo, y el pool no admite depósitos mientras haya un anticipo vencido, así que nadie puede elegir cuándo entrar o salir para llevarse valor de otros."],
    ["Un agente con límites", "El agente solo puede ejecutar el pago fijado al crear la operación, y solo tras una validación conforme."],
  ],
  faqTitle: "Preguntas",
  faq: [
    {
      q: "¿Qué es Avocate Harvest Escrow?",
      a: "Un escrow en USDC sobre la red Stellar para el comercio agrícola. Cada operación entre un comprador y un agricultor tiene su propio contrato inteligente, que guarda el precio hasta que se revisa la entrega y después paga al agricultor en segundos.",
    },
    {
      q: "¿Cómo cobra el agricultor?",
      a: "El comprador bloquea el precio en el contrato de la operación. Cuando un validador independiente confirma la entrega, el comprador, o un agente con permisos limitados que actúa por él, libera el pago y el agricultor lo recibe en USDC en segundos.",
    },
    {
      q: "¿Qué pasa si la entrega es incorrecta o no llega?",
      a: "Si el validador rechaza la entrega, el comprador puede recuperar todo el depósito, comisión incluida. Si la operación llega a su plazo sin liquidarse, el comprador también puede recuperar el dinero.",
    },
    {
      q: "¿Cómo funciona un anticipo y cuánto cuesta?",
      a: "Mientras una operación tiene fondos, un agricultor dado de alta por Avocate puede pedir a un pool de financiación hasta el 80% del precio. El agricultor firma primero y el comprador completa la petición. Al liquidarse la operación, el pool recupera el anticipo más hasta un 2% para sus inversores, en proporción al tiempo usado, y Avocate cobra un 0,5% del anticipo.",
    },
    {
      q: "¿Qué impide que comprador y agricultor se pongan de acuerdo contra el pool?",
      a: "Si una operación financiada llega a su plazo, el pool cobra primero y el comprador solo recibe el resto, así que dejarla caducar no les aporta nada. Solo un rechazo del validador independiente devuelve todo al comprador, y esa pérdida la reparten todos los inversores.",
    },
    {
      q: "¿Quién puede mover el dinero?",
      a: "Solo las reglas de la propia operación. El comprador puede pagar o, en las condiciones anteriores, recuperar su dinero. El agente solo puede ejecutar el pago pactado al crear la operación, tras una validación conforme. El administrador de Avocate fija las comisiones de las operaciones nuevas, pero no puede tocar el dinero de ninguna operación.",
    },
    {
      q: "¿Es dinero real?",
      a: "No. Es una beta en la red de pruebas de Stellar con USDC de prueba. Nada de lo que se hace en esta web mueve fondos reales.",
    },
  ],
  builtTitle: "Construido sobre",
  builtStellar: "Contratos inteligentes Soroban",
  builtUsdc: "Liquidado en USDC",
  builtOz: "Sigue los patrones de seguridad de OpenZeppelin",
  builtEvent: "Construido durante HackMeridian 2026, Lisboa.",
  footerBy: "de",
  footerSource: "Código fuente",
  footerBeta: "Beta en Stellar testnet, sin dinero real.",
  footerStellar:
    "Este software es independiente y no está afiliado, patrocinado ni respaldado por la Stellar Development Foundation. Stellar es una marca de la Stellar Development Foundation; todos los derechos reservados.",
  footerMarks:
    "USDC™ es una marca de Circle Internet Group, Inc. y/o sus filiales. OpenZeppelin es una marca de su titular. Todas las marcas mostradas pertenecen a sus respectivos titulares; su uso no implica respaldo.",
  stats: {
    live: "En vivo en Stellar",
    reading: "Leído de los contratos",
    unreachable: "Red no disponible",
    trades: "operaciones creadas en la plataforma",
    pool: "Pool de financiación",
    harvestFee: "Harvest fee (comprador)",
    advanceCost: "Coste del anticipo (agricultor)",
    explorer: "Ver el contrato de la plataforma en el explorador ↗",
  },
  figure: {
    title: "Una cosecha, un escrow",
    hint: "Pulsa para pausar",
    readout: "Validador: entrega conforme",
    coins: "Monedas USDC",
    seal: "El sello del validador",
    caption: (price, advance, repaid) =>
      `El dinero avanza por detrás y la mercancía por delante. El comprador bloquea ${price} USDC en la caja fuerte y el pool adelanta ${advance} USDC al agricultor mientras la caja sale del huerto. El validador pesa y sella la caja; después la caja fuerte devuelve al pool ${repaid} USDC (el anticipo más un 2%) y paga el resto al agricultor.`,
    steps: (price, advance, repaid) => [
      `El comprador bloquea ${price} USDC`,
      "La caja sale del huerto",
      `El pool adelanta ${advance} USDC al agricultor`,
      "La caja se pesa en la báscula",
      "Validador: entrega conforme",
      `La caja fuerte paga: ${repaid} USDC al pool y el resto al agricultor`,
      "Mercancía entregada. Lista para la próxima operación",
    ],
    paused: "Animación en pausa. Pulsa para volver a reproducir la operación.",
    playing: "Animación en marcha. Pulsa para pausarla.",
  },
};

const pt: LandingCopy = {
  metaTitle: "Avocate Harvest Escrow: o agricultor recebe em segundos",
  metaDescription:
    "Escrow em USDC na Stellar para o comércio agrícola. O agricultor recebe em segundos quando a entrega é confirmada e pode obter um adiantamento de um pool de financiamento.",
  betaNote: "Beta na rede de testes da Stellar. Apenas USDC de teste: neste site não circula dinheiro real.",
  homeLabel: "Avocate Harvest Escrow, início",
  openApp: "Abrir app",
  headline: "O agricultor recebe em segundos. O comprador só paga o que chega.",
  lead: "O comprador bloqueia o preço em USDC na Stellar. Um validador independente verifica a entrega e o dinheiro chega ao agricultor assim que é confirmada. Um pool de financiamento pode adiantar-lhe uma parte ainda antes.",
  startTrade: "Iniciar uma operação",
  howItWorks: "Como funciona",
  figureSection: "A máquina e os números em direto",
  earlyTitle: "Receber mais cedo, se for preciso",
  earlyText:
    "Enquanto o dinheiro está bloqueado, um agricultor registado pode pedir até 80% do preço a um pool financiado por vários investidores, que ganham até 2%. O agricultor assina primeiro e o comprador completa o pedido.",
  problemTitle: "O problema",
  problem: [
    "Um agricultor que vende a colheita para o estrangeiro costuma enviar primeiro e receber depois. O dinheiro pode demorar semanas a chegar, e a transferência internacional soma comissões e intermediários. O pequeno produtor raramente tem crédito para aguentar a espera.",
    "O comprador tem a preocupação oposta: pagar antes de receber a mercadoria obriga a confiar num vendedor que talvez nunca tenha visto. Quando ninguém quer dar o primeiro passo, os negócios ficam mais lentos e mais caros, ou nem chegam a acontecer.",
  ],
  stepsTitle: "Como corre uma operação",
  steps: [
    ["O comprador bloqueia o preço", "Cada operação tem o seu próprio contrato na Stellar. O comprador deposita o preço em USDC mais uma comissão de 1%; depois ninguém pode alterar o montante nem o destinatário."],
    ["O agricultor pode receber mais cedo", "Com o dinheiro bloqueado, um agricultor registado pode pedir ao pool de financiamento até 80% do preço. Assina primeiro e envia o pedido ao comprador, que o completa."],
    ["Um validador independente verifica a entrega", "O validador regista um único veredicto na blockchain, com a impressão digital do relatório de inspeção. Não pode ser reescrito."],
    ["O agricultor recebe em segundos", "Se a entrega estiver conforme, o comprador, ou um agente com permissões limitadas que age por ele, liberta o pagamento. Se o pool adiantou dinheiro, recebe primeiro, e o agricultor fica com o resto."],
    ["Ou o comprador recupera o dinheiro", "Se a entrega for rejeitada, o comprador recupera tudo com um clique, comissão incluída. Uma operação que chega ao prazo também volta para o comprador, depois de o pool ser reembolsado."],
  ],
  rulesTitle: "Regras que tiram o sentido à batota",
  rulesIntro: ["Os contratos aplicam cada regra, e todas estão no ", "README do projeto"],
  rules: [
    ["Só operações da Avocate", "Uma operação só conta se tiver sido criada pelo registo da plataforma. O pool e a app recusam contratos que a imitem."],
    ["Combinar não compensa", "Se uma operação financiada chega ao prazo, o pool recebe primeiro, por isso comprador e agricultor não podem dividir um adiantamento deixando-a expirar."],
    ["As disputas reais são partilhadas", "Quando o validador independente rejeita uma entrega, o comprador recupera tudo e os investidores assumem a perda na proporção das suas participações."],
    ["Justo para os investidores", "O rendimento conta pelo tempo em que cada adiantamento é usado, e o pool não aceita depósitos enquanto houver um adiantamento vencido, por isso ninguém pode escolher quando entrar ou sair para ficar com valor dos outros."],
    ["Um agente com limites", "O agente só pode executar o pagamento fixado ao criar a operação, e só depois de uma validação conforme."],
  ],
  faqTitle: "Perguntas",
  faq: [
    {
      q: "O que é o Avocate Harvest Escrow?",
      a: "Um escrow em USDC na rede Stellar para o comércio agrícola. Cada operação entre um comprador e um agricultor tem o seu próprio contrato inteligente, que guarda o preço até a entrega ser verificada e depois paga ao agricultor em segundos.",
    },
    {
      q: "Como recebe o agricultor?",
      a: "O comprador bloqueia o preço no contrato da operação. Quando um validador independente confirma a entrega, o comprador, ou um agente com permissões limitadas que age por ele, liberta o pagamento e o agricultor recebe-o em USDC em segundos.",
    },
    {
      q: "E se a entrega estiver errada ou não chegar?",
      a: "Se o validador rejeitar a entrega, o comprador pode recuperar todo o depósito, comissão incluída. Se a operação chegar ao prazo sem ser liquidada, o comprador também pode recuperar o dinheiro.",
    },
    {
      q: "Como funciona um adiantamento e quanto custa?",
      a: "Enquanto uma operação tem fundos, um agricultor registado pela Avocate pode pedir a um pool de financiamento até 80% do preço. O agricultor assina primeiro e o comprador completa o pedido. Quando a operação é liquidada, o pool recupera o adiantamento mais até 2% para os seus investidores, na proporção do tempo usado, e a Avocate cobra 0,5% do adiantamento.",
    },
    {
      q: "O que impede comprador e agricultor de combinarem contra o pool?",
      a: "Se uma operação financiada chega ao prazo, o pool recebe primeiro e o comprador só fica com o resto, por isso deixá-la expirar não lhes traz nada. Só uma rejeição do validador independente devolve tudo ao comprador, e essa perda é partilhada por todos os investidores.",
    },
    {
      q: "Quem pode movimentar o dinheiro?",
      a: "Apenas as regras da própria operação. O comprador pode pagar ou, nas condições acima, recuperar o dinheiro. O agente só pode executar o pagamento acordado ao criar a operação, depois de uma validação conforme. O administrador da Avocate define as comissões das novas operações, mas não pode tocar no dinheiro de nenhuma operação.",
    },
    {
      q: "É dinheiro real?",
      a: "Não. É uma beta na rede de testes da Stellar com USDC de teste. Nada neste site movimenta fundos reais.",
    },
  ],
  builtTitle: "Construído sobre",
  builtStellar: "Contratos inteligentes Soroban",
  builtUsdc: "Liquidado em USDC",
  builtOz: "Segue os padrões de segurança da OpenZeppelin",
  builtEvent: "Construído durante o HackMeridian 2026, Lisboa.",
  footerBy: "por",
  footerSource: "Código-fonte",
  footerBeta: "Beta na Stellar testnet, sem dinheiro real.",
  footerStellar:
    "Este software é independente e não é afiliado, patrocinado nem apoiado pela Stellar Development Foundation. Stellar é uma marca da Stellar Development Foundation; todos os direitos reservados.",
  footerMarks:
    "USDC™ é uma marca da Circle Internet Group, Inc. e/ou das suas afiliadas. OpenZeppelin é uma marca do seu titular. Todas as marcas apresentadas pertencem aos respetivos titulares; a sua utilização não implica apoio.",
  stats: {
    live: "Em direto na Stellar",
    reading: "Lido dos contratos",
    unreachable: "Rede indisponível",
    trades: "operações criadas na plataforma",
    pool: "Pool de financiamento",
    harvestFee: "Harvest fee (comprador)",
    advanceCost: "Custo do adiantamento (agricultor)",
    explorer: "Ver o contrato da plataforma no explorador ↗",
  },
  figure: {
    title: "Uma colheita, um escrow",
    hint: "Clique para pausar",
    readout: "Validador: entrega conforme",
    coins: "Moedas USDC",
    seal: "O selo do validador",
    caption: (price, advance, repaid) =>
      `O dinheiro avança por trás e a mercadoria pela frente. O comprador bloqueia ${price} USDC no cofre e o pool adianta ${advance} USDC ao agricultor enquanto a caixa sai do pomar. O validador pesa e sela a caixa; depois o cofre reembolsa o pool em ${repaid} USDC (o adiantamento mais 2%) e paga o resto ao agricultor.`,
    steps: (price, advance, repaid) => [
      `O comprador bloqueia ${price} USDC`,
      "A caixa sai do pomar",
      `O pool adianta ${advance} USDC ao agricultor`,
      "A caixa é pesada na balança",
      "Validador: entrega conforme",
      `O cofre paga: ${repaid} USDC ao pool e o resto ao agricultor`,
      "Mercadoria entregue. Pronta para a próxima operação",
    ],
    paused: "Animação em pausa. Prima para reproduzir de novo a operação.",
    playing: "Animação em curso. Prima para a pausar.",
  },
};

export const LANDING: Record<Lang, LandingCopy> = { en, es, pt };
