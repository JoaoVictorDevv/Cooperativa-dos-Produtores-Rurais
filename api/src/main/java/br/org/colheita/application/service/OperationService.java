package br.org.colheita.application.service;

import br.org.colheita.application.port.out.*;
import br.org.colheita.domain.model.Actor;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

public final class OperationService {
    private final OperationPort operations; private final AuditPort audit; private final UnitOfWorkPort unitOfWork;
    public OperationService(OperationPort operations,AuditPort audit,UnitOfWorkPort unitOfWork){this.operations=operations;this.audit=audit;this.unitOfWork=unitOfWork;}
    public List<Map<String,Object>> list(Actor a,UUID weekId,String resource){return operations.list(a.organizationId(),weekId,resource);}
    public UUID schoolOrder(Actor a,UUID w,OperationPort.SchoolOrder c){return mutate(a,"SCHOOL_ORDER_UPSERT","SchoolOrder",()->operations.upsertSchoolOrder(a.organizationId(),w,c));}
    public UUID schoolDelivery(Actor a,UUID w,OperationPort.SchoolDelivery c){return mutate(a,"SCHOOL_DELIVERY_UPSERT","SchoolDelivery",()->operations.upsertSchoolDelivery(a.organizationId(),w,c));}
    public UUID schoolReturn(Actor a,UUID w,OperationPort.SchoolReturn c){return mutate(a,"SCHOOL_RETURN_UPSERT","SchoolReturn",()->operations.upsertSchoolReturn(a.organizationId(),w,c));}
    public UUID producerAllocation(Actor a,UUID w,OperationPort.ProducerAllocation c){return mutate(a,"PRODUCER_ALLOCATION_UPSERT","ProducerAllocation",()->operations.upsertProducerAllocation(a.organizationId(),w,c));}
    public UUID producerOrder(Actor a,UUID w,OperationPort.ProducerOrder c){return mutate(a,"PRODUCER_ORDER_UPSERT","ProducerOrder",()->operations.upsertProducerOrder(a.organizationId(),w,c));}
    public UUID producerDelivery(Actor a,UUID w,OperationPort.ProducerDelivery c){return mutate(a,"PRODUCER_DELIVERY_UPSERT","ProducerDelivery",()->operations.upsertProducerDelivery(a.organizationId(),w,c));}
    public UUID producerReturn(Actor a,UUID w,OperationPort.ProducerReturn c){return mutate(a,"PRODUCER_RETURN_UPSERT","ProducerReturn",()->operations.upsertProducerReturn(a.organizationId(),w,c));}
    public UUID weeklyCost(Actor a,UUID w,OperationPort.WeeklyCost c){return mutate(a,"WEEKLY_COST_UPSERT","WeeklyCost",()->operations.upsertWeeklyCost(a.organizationId(),w,c));}
    private UUID mutate(Actor a,String action,String type,Supplier<UUID> work){return unitOfWork.execute(()->{UUID id=work.get();audit.record(a,action,type,id,null,null,null);return id;});}
}

