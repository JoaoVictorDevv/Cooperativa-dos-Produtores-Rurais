package br.org.colheita.application.port.out;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface OperationPort {
    record SchoolOrder(UUID schoolId, UUID productId, BigDecimal quantity, UUID priceId) {}
    record SchoolDelivery(UUID schoolId, String weekday, Instant deliveredAt, String note) {}
    record SchoolReturn(UUID schoolId, UUID productId, BigDecimal quantity, UUID reasonId) {}
    record ProducerAllocation(UUID producerId, UUID productId, BigDecimal quantity) {}
    record ProducerOrder(UUID producerId, UUID productId, BigDecimal quantity, UUID priceId) {}
    record ProducerDelivery(UUID producerId, UUID productId, BigDecimal quantity, Instant deliveredAt,
                            UUID priceId, BigDecimal logisticsDeduction) {}
    record ProducerReturn(UUID producerId, UUID productId, BigDecimal quantity, UUID reasonId) {}
    record WeeklyCost(String category, BigDecimal amount) {}

    List<Map<String, Object>> list(UUID orgId, UUID weekId, String resource);
    UUID upsertSchoolOrder(UUID orgId, UUID weekId, SchoolOrder command);
    UUID upsertSchoolDelivery(UUID orgId, UUID weekId, SchoolDelivery command);
    UUID upsertSchoolReturn(UUID orgId, UUID weekId, SchoolReturn command);
    UUID upsertProducerAllocation(UUID orgId, UUID weekId, ProducerAllocation command);
    UUID upsertProducerOrder(UUID orgId, UUID weekId, ProducerOrder command);
    UUID upsertProducerDelivery(UUID orgId, UUID weekId, ProducerDelivery command);
    UUID upsertProducerReturn(UUID orgId, UUID weekId, ProducerReturn command);
    UUID upsertWeeklyCost(UUID orgId, UUID weekId, WeeklyCost command);
}

