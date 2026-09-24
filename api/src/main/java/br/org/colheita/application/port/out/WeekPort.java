package br.org.colheita.application.port.out;

import br.org.colheita.domain.model.PageResult;
import br.org.colheita.domain.model.WeekModels.ClosingBlockers;
import br.org.colheita.domain.model.WeekModels.Week;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface WeekPort {
    PageResult<Week> list(UUID orgId, String status, int page, int size);
    Optional<Week> find(UUID orgId, UUID weekId, boolean forUpdate);
    Optional<Week> findOpen(UUID orgId);
    Week create(UUID orgId, LocalDate referenceDate, LocalDate startDate, LocalDate endDate, String notes);
    ClosingBlockers closingBlockers(UUID orgId, UUID weekId);
    Week close(UUID orgId, UUID weekId, UUID userId);
    Week reopen(UUID orgId, UUID weekId, UUID userId, String reason);
}

