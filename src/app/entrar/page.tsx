import "../coop/coop.css";
import { FormEntrar } from "./FormEntrar";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const q = await searchParams;
  const volta = typeof q.volta === "string" ? q.volta : "/coop";
  return (
    <div className="coop">
      <main className="coop-main entrar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/coop/logo.jpg" alt="" width={96} height={96} />
        <h1>App da Cooperativa</h1>
        <p className="sub">Digite o PIN para entrar.</p>
        <FormEntrar volta={volta} />
      </main>
    </div>
  );
}
