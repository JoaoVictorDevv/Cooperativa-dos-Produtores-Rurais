package br.org.colheita.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.org.colheita.application.port.out.AuditPort;
import br.org.colheita.application.port.out.IdentityPort;
import br.org.colheita.application.port.out.PasswordPort;
import br.org.colheita.application.port.out.UnitOfWorkPort;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.Actor;
import br.org.colheita.domain.model.RoleCode;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock private IdentityPort identities;
    @Mock private PasswordPort passwords;
    @Mock private AuditPort audit;

    private UserService service;
    private Actor actor;

    @BeforeEach
    void setUp() {
        service = new UserService(identities, passwords, audit, new DirectUnitOfWork());
        actor = new Actor(UUID.randomUUID(), UUID.randomUUID(), "Admin",
                "admin@cooperativa.test", RoleCode.ADMIN, Set.of("users.manage"));
    }

    @Test
    void rejectsShortPasswordsBeforePersistence() {
        assertThatThrownBy(() -> service.create(actor, "Pessoa", "pessoa@test.local",
                "senha-curta", RoleCode.OPERADOR))
                .isInstanceOf(DomainException.class)
                .extracting(error -> ((DomainException) error).status())
                .isEqualTo(422);

        verify(identities, never()).createUser(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void protectsTheLastActiveAdministrator() {
        when(identities.activeAdminCount(actor.organizationId())).thenReturn(1L);

        assertThatThrownBy(() -> service.update(actor, actor.userId(), "Admin",
                RoleCode.CONSULTA, true))
                .isInstanceOf(DomainException.class)
                .extracting(error -> ((DomainException) error).status())
                .isEqualTo(409);

        verify(identities, never()).updateUser(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyBoolean());
    }

    private static final class DirectUnitOfWork implements UnitOfWorkPort {
        @Override public <T> T execute(Supplier<T> work) { return work.get(); }
        @Override public void execute(Runnable work) { work.run(); }
    }
}
