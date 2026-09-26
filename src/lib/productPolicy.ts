// Produtos retirados do fluxo ativo por decisão da cooperativa. Continuam no
// histórico (consultas, fichas, PDFs), mas não entram em novos lançamentos
// nem em importações. Quando o cadastro real tiver `active = false` para
// eles (tarefa do Lucas no banco), esta lista pode ser esvaziada.
export const RETIRED_PRODUCT_SLUGS: ReadonlySet<string> = new Set(["ovos"]);

export function isOfferedForNewEntries(product: { slug: string; active: boolean }): boolean {
  return product.active && !RETIRED_PRODUCT_SLUGS.has(product.slug);
}
