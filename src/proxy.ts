import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACESSO, chaveLocal, iguais, lerAcesso, valorCookie } from "@/lib/coop/acesso";

// Todo o app pede o PIN (ou o cookie de quem já entrou), porque ele abre na rede
// para o celular. A tela /entrar e os arquivos da logo/ícone ficam livres.
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const acesso = await lerAcesso();
  const cookie = request.cookies.get(COOKIE_ACESSO)?.value;
  const dentro = Boolean(acesso && cookie && iguais(cookie, valorCookie(acesso.segredo)));

  if (pathname === "/entrar") {
    // Atalho do próprio PC: /entrar?chave=... entra sem PIN.
    const chave = searchParams.get("chave");
    const local = chave ? await chaveLocal() : null;
    if (chave && local && iguais(chave, local)) {
      const a = acesso ?? (await lerAcesso(true));
      const r = NextResponse.redirect(new URL("/coop", request.url));
      if (a) r.cookies.set({ name: COOKIE_ACESSO, value: valorCookie(a.segredo), httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
      return r;
    }
    if (dentro) return NextResponse.redirect(new URL("/coop", request.url));
    return NextResponse.next();
  }
  if (dentro) return NextResponse.next();
  const url = new URL("/entrar", request.url);
  if (pathname !== "/" && pathname !== "/coop") url.searchParams.set("volta", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|coop/logo|manifest.webmanifest|favicon.ico).*)"],
};
