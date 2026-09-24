package br.org.colheita.domain.exception;

public class DomainException extends RuntimeException {
    private final int status;
    public DomainException(String message, int status) { super(message); this.status = status; }
    public int status() { return status; }
    public static DomainException notFound(String message) { return new DomainException(message, 404); }
    public static DomainException conflict(String message) { return new DomainException(message, 409); }
    public static DomainException forbidden(String message) { return new DomainException(message, 403); }
    public static DomainException unauthorized(String message) { return new DomainException(message, 401); }
    public static DomainException invalid(String message) { return new DomainException(message, 422); }
}

