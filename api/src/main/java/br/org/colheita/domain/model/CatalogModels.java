package br.org.colheita.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class CatalogModels {
    private CatalogModels() {}
    public record Product(UUID id, String slug, String name, String unit, boolean active) {}
    public record School(UUID id, String code, String name, String neighborhood, String address, String phone, boolean active) {}
    public record Producer(UUID id, String internalId, String name, String document, String phone, boolean active) {}
    public record ReturnReason(UUID id, int code, String description, boolean active) {}
    public record Price(UUID id, UUID productId, BigDecimal price, Instant validFrom, Instant validTo) {}
}

