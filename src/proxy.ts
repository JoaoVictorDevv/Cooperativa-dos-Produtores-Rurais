import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, COOKIE_NAME } from "@/lib/session";

// Checagem OTIMISTA (nao substitui o verifySession() do DAL, que confere
// no banco se o usuario ainda esta ativo). So evita que uma pagina
// protegida chegue a renderizar sem nenhum cookie de sessao.
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  if (!isPublic && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
