package br.org.colheita.application.port.out;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface ReportPort {
    record WeekSummary(UUID weekId, long weekNumber, BigDecimal receivable, BigDecimal payable,
                       BigDecimal costs, BigDecimal balance) {}
    WeekSummary weekSummary(UUID orgId, UUID weekId);
    List<Map<String, Object>> audit(UUID orgId, String entityType, UUID entityId, int limit);
}

