import { describe, expect, it } from "vitest";
import { checkDisposableMarker, checkDisposableTarget, markerFor } from "./disposableDb";

const SECRET = "s3nh4-que-nao-pode-vazar";
const url = (host: string, db: string) => `postgresql://postgres:${SECRET}@${host}:5432/${db}?schema=public`;
const TOKEN = "a1b2c3";

describe("proteção de testes destrutivos", () => {
  it("sem o código do executor, recusa (rodar o arquivo direto não apaga nada)", () => {
    expect(() => checkDisposableTarget({ DATABASE_URL: url("localhost", "colheita_descartavel_1_abc") })).toThrow(/npm run test:integration/);
  });

  it("nome com 'test' não basta", () => {
    expect(() => checkDisposableTarget({ DATABASE_URL: url("localhost", "colheita_test"), COLHEITA_TEST_DB_TOKEN: TOKEN })).toThrow(/não foi criado pelo executor/);
  });

  it("servidor remoto é recusado sem liberação explícita", () => {
    expect(() => checkDisposableTarget({ DATABASE_URL: url("db.exemplo.com", "colheita_descartavel_1_abc"), COLHEITA_TEST_DB_TOKEN: TOKEN })).toThrow(/não é local/);
  });

  it("banco do executor em servidor local é aceito na primeira etapa", () => {
    expect(checkDisposableTarget({ DATABASE_URL: url("localhost", "colheita_descartavel_1_abc"), COLHEITA_TEST_DB_TOKEN: TOKEN })).toEqual({
      host: "localhost",
      database: "colheita_descartavel_1_abc",
    });
  });

  it("sem a marca desta execução no banco, recusa", () => {
    const target = { host: "localhost", database: "colheita_descartavel_1_abc" };
    expect(() => checkDisposableMarker(target, { currentDatabase: target.database, comment: null }, TOKEN)).toThrow(/não tem a marca/);
    expect(() => checkDisposableMarker(target, { currentDatabase: target.database, comment: markerFor("outro") }, TOKEN)).toThrow(/não tem a marca/);
    expect(() => checkDisposableMarker(target, { currentDatabase: "colheita", comment: markerFor(TOKEN) }, TOKEN)).toThrow(/não é o banco descartável/);
    expect(() => checkDisposableMarker(target, { currentDatabase: target.database, comment: markerFor(TOKEN) }, TOKEN)).not.toThrow();
  });

  it("nenhuma mensagem de erro expõe a senha da URL", () => {
    const cases = [
      { DATABASE_URL: url("localhost", "colheita_descartavel_1_abc") },
      { DATABASE_URL: url("localhost", "colheita"), COLHEITA_TEST_DB_TOKEN: TOKEN },
      { DATABASE_URL: url("db.exemplo.com", "colheita_descartavel_1_abc"), COLHEITA_TEST_DB_TOKEN: TOKEN },
      { DATABASE_URL: `postgresql://postgres:${SECRET}@%%%/x`, COLHEITA_TEST_DB_TOKEN: TOKEN },
    ];
    for (const env of cases) {
      try {
        checkDisposableTarget(env);
        throw new Error("deveria ter recusado");
      } catch (err) {
        expect((err as Error).message).not.toContain(SECRET);
      }
    }
  });
});
