import type { Identity } from "../../domain/actor.js";

export interface TokenVerifier {
  verify(accessToken: string): Promise<Identity>;
}
