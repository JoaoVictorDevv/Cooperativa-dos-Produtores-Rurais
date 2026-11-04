// Metodologia de cobrança ainda em uso (specs/008): enquanto não houver
// registro de entrega por escola/produto, "a cobrar" é calculado por
// pedido − devolução. Os valores são calculados, não quitação.
export const LEGACY_BILLING_NOTE =
  "Metodologia atual: a cobrar = (pedido da escola - devolução) × preço; a pagar = (entrega do produtor - devolução no galpão) × (preço - desconto de logística). A regra confirmada cobra pelo aceito na escola, o que depende do registro de entrega por escola/produto (ainda não disponível). Valores calculados, não quitados.";
