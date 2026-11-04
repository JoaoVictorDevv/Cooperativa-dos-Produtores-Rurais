import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { TokenVerifier } from "../../application/ports/auth.js";
import type { Identity } from "../../domain/actor.js";
import { unauthorized } from "../../domain/errors.js";

export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly url: string,
    private readonly publishableKey: string,
    private readonly mode: "jwks" | "auth-server",
  ) {
    this.jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }

  async verify(accessToken: string): Promise<Identity> {
    try {
      if (this.mode === "auth-server") return await this.verifyWithAuthServer(accessToken);
      const { payload } = await jwtVerify(accessToken, this.jwks, {
        issuer: `${this.url}/auth/v1`,
        audience: "authenticated",
      });
      if (!payload.sub) throw unauthorized();
      return {
        userId: payload.sub,
        email: typeof payload.email === "string" ? payload.email : null,
        accessToken,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AppError") throw error;
      throw unauthorized();
    }
  }

  private async verifyWithAuthServer(accessToken: string): Promise<Identity> {
    const client = createClient(this.url, this.publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) throw unauthorized();
    return { userId: data.user.id, email: data.user.email ?? null, accessToken };
  }
}
