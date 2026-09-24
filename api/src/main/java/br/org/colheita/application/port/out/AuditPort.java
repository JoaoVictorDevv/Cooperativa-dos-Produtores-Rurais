package br.org.colheita.application.port.out;

import br.org.colheita.domain.model.Actor;
import java.util.UUID;

public interface AuditPort {
    void record(Actor actor, String action, String entityType, UUID entityId,
                Object before, Object after, String reason);
}

