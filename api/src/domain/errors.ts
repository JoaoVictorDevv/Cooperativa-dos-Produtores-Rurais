export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const unauthorized = (message = "Sessão inválida ou expirada.") => new AppError(message, 401, "UNAUTHORIZED");
export const forbidden = (message = "Você não tem permissão para esta ação.") => new AppError(message, 403, "FORBIDDEN");
export const notFound = (message = "Registro não encontrado.") => new AppError(message, 404, "NOT_FOUND");
