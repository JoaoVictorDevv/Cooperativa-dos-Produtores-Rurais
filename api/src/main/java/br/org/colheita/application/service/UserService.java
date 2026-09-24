package br.org.colheita.application.service;

import br.org.colheita.application.port.out.*;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.*;
import java.util.UUID;

public final class UserService {
    private final IdentityPort identities; private final PasswordPort passwords;
    private final AuditPort audit; private final UnitOfWorkPort unitOfWork;
    public UserService(IdentityPort identities, PasswordPort passwords, AuditPort audit, UnitOfWorkPort unitOfWork) {
        this.identities=identities; this.passwords=passwords; this.audit=audit; this.unitOfWork=unitOfWork;
    }
    public PageResult<IdentityPort.UserView> list(Actor actor, String search, int page, int size) {
        return identities.listUsers(actor.organizationId(), search, page, Math.min(size, 100));
    }
    public IdentityPort.UserView create(Actor actor, String name, String email, String password, RoleCode role) {
        validatePassword(password);
        return unitOfWork.execute(() -> {
            var created=identities.createUser(actor.organizationId(), new IdentityPort.NewUser(name.trim(), email.trim().toLowerCase(), passwords.encode(password), role));
            audit.record(actor,"USER_CREATE","User",created.id(),null,created,null); return created;
        });
    }
    public IdentityPort.UserView update(Actor actor, UUID userId, String name, RoleCode role, boolean active) {
        if ((!active || role != RoleCode.ADMIN) && userId.equals(actor.userId()) && identities.activeAdminCount(actor.organizationId()) <= 1) {
            throw DomainException.conflict("O último administrador ativo não pode ser removido.");
        }
        return unitOfWork.execute(() -> {
            var updated=identities.updateUser(actor.organizationId(),userId,name.trim(),role,active);
            audit.record(actor,"USER_UPDATE","User",userId,null,updated,null); return updated;
        });
    }
    public void resetPassword(Actor actor, UUID userId, String password) {
        validatePassword(password);
        unitOfWork.execute(() -> { identities.updatePassword(actor.organizationId(),userId,passwords.encode(password));
            audit.record(actor,"USER_PASSWORD_RESET","User",userId,null,null,"Redefinição administrativa"); });
    }
    private void validatePassword(String password) {
        if (password == null || password.length() < 12) throw DomainException.invalid("A senha deve ter pelo menos 12 caracteres.");
    }
}

