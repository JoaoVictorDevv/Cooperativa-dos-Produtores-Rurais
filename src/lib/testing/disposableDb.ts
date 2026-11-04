// Proteção para testes destrutivos (specs/001, adendo 2026-09). O nome do
// banco sozinho não prova nada: só se aceita um banco criado pelo executor
// `scripts/run-integration-tests.mjs` nesta execução, marcado com um código
// aleatório que só o executor conhece. Mensagens nunca incluem a URL (que
// pode conter senha).

export const DISPOSABLE_DB_PREFIX = "colheita_descartavel_";
export const DISPOSABLE_DB_NAME = /^colheita_descartavel_[a-z0-9_]{6,60}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function markerFor(token: string): string {
  return `colheita:descartavel:${token}`;
}

export interface DisposableTarget {
  host: string;
  database: string;
}

// Validação sem acessar o banco: URL legível, servidor local (salvo liberação
// explícita) e nome no padrão do executor.
export function checkDisposableTarget(
  env: Record<string, string | undefined>,
): DisposableTarget {
  if (!env.DATABASE_URL || !env.COLHEITA_TEST_DB_TOKEN) {
    throw new Error(
      "Testes destrutivos só rodam pelo executor que cria um banco descartável: use `npm run test:integration`.",
    );
  }
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL ilegível; recusando rodar testes destrutivos.");
  }
  const database = url.pathname.replace(/^\//, "");
  if (!LOCAL_HOSTS.has(url.hostname) && env.COLHEITA_TEST_ALLOW_REMOTE !== "1") {
    throw new Error(`Servidor "${url.hostname}" não é local; recusando rodar testes destrutivos.`);
  }
  if (!DISPOSABLE_DB_NAME.test(database)) {
    throw new Error(`O banco "${database}" não foi criado pelo executor de testes; recusando apagar dados.`);
  }
  return { host: url.hostname, database };
}

// Confirma, no próprio banco, que ele é o que o executor criou nesta execução.
export function checkDisposableMarker(
  target: DisposableTarget,
  observed: { currentDatabase: string; comment: string | null },
  token: string,
): void {
  if (observed.currentDatabase !== target.database) {
    throw new Error("O banco conectado não é o banco descartável esperado; recusando apagar dados.");
  }
  if (observed.comment !== markerFor(token)) {
    throw new Error(`O banco "${target.database}" não tem a marca desta execução; recusando apagar dados.`);
  }
}
