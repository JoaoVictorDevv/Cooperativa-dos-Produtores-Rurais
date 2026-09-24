package br.org.colheita.domain.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class WeekModels {
    private WeekModels() {}
    public enum Status { ABERTA, FECHADA }
    public record Week(UUID id, long number, LocalDate referenceDate, LocalDate startDate, LocalDate endDate,
                       Status status, String notes, Instant createdAt, Instant closedAt, UUID closedById) {}
    public record ClosingBlockers(long producerDeliveries, long schoolDeliveries) {
        public long total() { return producerDeliveries + schoolDeliveries; }
    }
}

