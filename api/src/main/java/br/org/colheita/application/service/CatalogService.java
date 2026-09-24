package br.org.colheita.application.service;

import br.org.colheita.application.port.out.*;
import br.org.colheita.domain.model.Actor;
import br.org.colheita.domain.model.CatalogModels.*;
import br.org.colheita.domain.model.PageResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class CatalogService {
    private final CatalogPort catalogs; private final AuditPort audit; private final UnitOfWorkPort unitOfWork;
    public CatalogService(CatalogPort catalogs, AuditPort audit, UnitOfWorkPort unitOfWork) {
        this.catalogs=catalogs; this.audit=audit; this.unitOfWork=unitOfWork;
    }
    public PageResult<Product> products(Actor a,String q,int p,int s){return catalogs.listProducts(a.organizationId(),q,p,Math.min(s,100));}
    public Product saveProduct(Actor a,UUID id,String slug,String name,String unit,boolean active){return unitOfWork.execute(()->{var v=catalogs.saveProduct(a.organizationId(),id,slug,name,unit,active);audit.record(a,id==null?"PRODUCT_CREATE":"PRODUCT_UPDATE","Product",v.id(),null,v,null);return v;});}
    public PageResult<School> schools(Actor a,String q,int p,int s){return catalogs.listSchools(a.organizationId(),q,p,Math.min(s,100));}
    public School saveSchool(Actor a,UUID id,String code,String name,String neighborhood,String address,String phone,boolean active){return unitOfWork.execute(()->{var v=catalogs.saveSchool(a.organizationId(),id,code,name,neighborhood,address,phone,active);audit.record(a,id==null?"SCHOOL_CREATE":"SCHOOL_UPDATE","School",v.id(),null,v,null);return v;});}
    public PageResult<Producer> producers(Actor a,String q,int p,int s){return catalogs.listProducers(a.organizationId(),q,p,Math.min(s,100));}
    public Producer saveProducer(Actor a,UUID id,String internalId,String name,String document,String phone,boolean active){return unitOfWork.execute(()->{var v=catalogs.saveProducer(a.organizationId(),id,internalId,name,document,phone,active);audit.record(a,id==null?"PRODUCER_CREATE":"PRODUCER_UPDATE","Producer",v.id(),null,v,null);return v;});}
    public PageResult<ReturnReason> reasons(Actor a,String q,int p,int s){return catalogs.listReturnReasons(a.organizationId(),q,p,Math.min(s,100));}
    public ReturnReason saveReason(Actor a,UUID id,int code,String description,boolean active){return unitOfWork.execute(()->{var v=catalogs.saveReturnReason(a.organizationId(),id,code,description,active);audit.record(a,id==null?"REASON_CREATE":"REASON_UPDATE","ReturnReason",v.id(),null,v,null);return v;});}
    public PageResult<Price> prices(Actor a,UUID productId,int p,int s){return catalogs.listPrices(a.organizationId(),productId,p,Math.min(s,100));}
    public Price schedulePrice(Actor a,UUID productId,BigDecimal price,Instant validFrom){return unitOfWork.execute(()->{var v=catalogs.schedulePrice(a.organizationId(),productId,price,validFrom);audit.record(a,"PRICE_SCHEDULE","Price",v.id(),null,v,null);return v;});}
}

