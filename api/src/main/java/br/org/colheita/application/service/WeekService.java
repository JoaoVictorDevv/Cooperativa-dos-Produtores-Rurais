package br.org.colheita.application.service;

import br.org.colheita.application.port.out.*;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.*;
import br.org.colheita.domain.model.WeekModels.Week;
import java.time.LocalDate;
import java.util.UUID;

public final class WeekService {
    private final WeekPort weeks; private final AuditPort audit; private final UnitOfWorkPort unitOfWork;
    public WeekService(WeekPort weeks,AuditPort audit,UnitOfWorkPort unitOfWork){this.weeks=weeks;this.audit=audit;this.unitOfWork=unitOfWork;}
    public PageResult<Week> list(Actor a,String status,int page,int size){return weeks.list(a.organizationId(),status,page,Math.min(size,100));}
    public Week find(Actor a,UUID id){return weeks.find(a.organizationId(),id,false).orElseThrow(()->DomainException.notFound("Semana não encontrada."));}
    public Week create(Actor a,LocalDate reference,LocalDate start,LocalDate end,String notes){
        if(start.isAfter(end)||reference.isBefore(start)||reference.isAfter(end))throw DomainException.invalid("A data de referência deve estar dentro do período.");
        return unitOfWork.execute(()->{var v=weeks.create(a.organizationId(),reference,start,end,notes);audit.record(a,"WEEK_CREATE","Week",v.id(),null,v,null);return v;});
    }
    public Week close(Actor a,UUID id){return unitOfWork.execute(()->{var before=weeks.find(a.organizationId(),id,true).orElseThrow(()->DomainException.notFound("Semana não encontrada."));if(before.status()==WeekModels.Status.FECHADA)return before;var blockers=weeks.closingBlockers(a.organizationId(),id);if(blockers.total()>0)throw DomainException.conflict("Fechamento bloqueado: %d entrega(s) de produtor e %d entrega(s) de escola pendente(s).".formatted(blockers.producerDeliveries(),blockers.schoolDeliveries()));var after=weeks.close(a.organizationId(),id,a.userId());audit.record(a,"WEEK_CLOSE","Week",id,before,after,null);return after;});}
    public Week reopen(Actor a,UUID id,String reason){if(reason==null||reason.trim().length()<10)throw DomainException.invalid("Informe uma justificativa com pelo menos 10 caracteres.");return unitOfWork.execute(()->{var before=weeks.find(a.organizationId(),id,true).orElseThrow(()->DomainException.notFound("Semana não encontrada."));if(before.status()!=WeekModels.Status.FECHADA)throw DomainException.conflict("A semana já está aberta.");var after=weeks.reopen(a.organizationId(),id,a.userId(),reason.trim());audit.record(a,"WEEK_REOPEN","Week",id,before,after,reason.trim());return after;});}
}

