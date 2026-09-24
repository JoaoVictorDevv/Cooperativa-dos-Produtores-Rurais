package br.org.colheita.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.org.colheita.application.port.out.AuditPort;
import br.org.colheita.application.port.out.UnitOfWorkPort;
import br.org.colheita.application.port.out.WeekPort;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.Actor;
import br.org.colheita.domain.model.RoleCode;
import br.org.colheita.domain.model.WeekModels;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WeekServiceTest {
    @Mock private WeekPort weeks;
    @Mock private AuditPort audit;

    private WeekService service;
    private Actor actor;

    @BeforeEach
    void setUp() {
        service = new WeekService(weeks, audit, new DirectUnitOfWork());
        actor = new Actor(UUID.randomUUID(), UUID.randomUUID(), "Administrador",
                "admin@cooperativa.test", RoleCode.ADMIN, Set.of("weeks.manage"));
    }

    @Test
    void refusesToCreateWeekWhenReferenceIsOutsidePeriod() {
        assertThatThrownBy(() -> service.create(actor,
                LocalDate.of(2026, 9, 28), LocalDate.of(2026, 9, 21),
                LocalDate.of(2026, 9, 27), null))
                .isInstanceOf(DomainException.class)
                .extracting(error -> ((DomainException) error).status())
                .isEqualTo(422);

        verify(weeks, never()).create(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void refusesToCloseWeekWithPendingDeliveries() {
        UUID weekId = UUID.randomUUID();
        var open = week(weekId, WeekModels.Status.ABERTA);
        when(weeks.find(actor.organizationId(), weekId, true)).thenReturn(Optional.of(open));
        when(weeks.closingBlockers(actor.organizationId(), weekId))
                .thenReturn(new WeekModels.ClosingBlockers(2, 1));

        assertThatThrownBy(() -> service.close(actor, weekId))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("2 entrega(s) de produtor")
                .hasMessageContaining("1 entrega(s) de escola")
                .extracting(error -> ((DomainException) error).status())
                .isEqualTo(409);

        verify(weeks, never()).close(actor.organizationId(), weekId, actor.userId());
    }

    @Test
    void closesAndAuditsWeekWithoutBlockers() {
        UUID weekId = UUID.randomUUID();
        var open = week(weekId, WeekModels.Status.ABERTA);
        var closed = week(weekId, WeekModels.Status.FECHADA);
        when(weeks.find(actor.organizationId(), weekId, true)).thenReturn(Optional.of(open));
        when(weeks.closingBlockers(actor.organizationId(), weekId))
                .thenReturn(new WeekModels.ClosingBlockers(0, 0));
        when(weeks.close(actor.organizationId(), weekId, actor.userId())).thenReturn(closed);

        assertThat(service.close(actor, weekId)).isEqualTo(closed);
        verify(audit).record(actor, "WEEK_CLOSE", "Week", weekId, open, closed, null);
    }

    @Test
    void requiresMeaningfulReasonToReopenWeek() {
        assertThatThrownBy(() -> service.reopen(actor, UUID.randomUUID(), "curta"))
                .isInstanceOf(DomainException.class)
                .extracting(error -> ((DomainException) error).status())
                .isEqualTo(422);
    }

    private WeekModels.Week week(UUID id, WeekModels.Status status) {
        return new WeekModels.Week(id, 12, LocalDate.of(2026, 9, 23),
                LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 27), status,
                null, Instant.parse("2026-09-21T12:00:00Z"),
                status == WeekModels.Status.FECHADA ? Instant.parse("2026-09-27T20:00:00Z") : null,
                status == WeekModels.Status.FECHADA ? actor.userId() : null);
    }

    private static final class DirectUnitOfWork implements UnitOfWorkPort {
        @Override public <T> T execute(Supplier<T> work) { return work.get(); }
        @Override public void execute(Runnable work) { work.run(); }
    }
}
