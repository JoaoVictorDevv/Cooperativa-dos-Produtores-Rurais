package br.org.colheita.infrastructure.persistence;

import br.org.colheita.application.port.out.WeekPort;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.PageResult;
import br.org.colheita.domain.model.WeekModels.*;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class WeekJdbcAdapter implements WeekPort {
    private final JdbcClient jdbc;
    public WeekJdbcAdapter(JdbcClient jdbc){this.jdbc=jdbc;}
    @Override public PageResult<Week> list(UUID org,String status,int page,int size){String filter=status==null?"":status;long total=jdbc.sql("SELECT count(*) FROM colheita.weeks WHERE organization_id=:org AND (:status='' OR status::text=:status)").param("org",org).param("status",filter).query(Long.class).single();var items=jdbc.sql("SELECT * FROM colheita.weeks WHERE organization_id=:org AND (:status='' OR status::text=:status) ORDER BY number DESC LIMIT :size OFFSET :offset").param("org",org).param("status",filter).param("size",size).param("offset",page*size).query((rs,n)->map(rs)).list();return new PageResult<>(items,total,page,size);}
    @Override public Optional<Week> find(UUID org,UUID id,boolean lock){return jdbc.sql("SELECT * FROM colheita.weeks WHERE organization_id=:org AND id=:id"+(lock?" FOR UPDATE":"")).param("org",org).param("id",id).query((rs,n)->map(rs)).optional();}
    @Override public Optional<Week> findOpen(UUID org){return jdbc.sql("SELECT * FROM colheita.weeks WHERE organization_id=:org AND status='ABERTA'").param("org",org).query((rs,n)->map(rs)).optional();}
    @Override public Week create(UUID org,LocalDate reference,LocalDate start,LocalDate end,String notes){UUID id=jdbc.sql("INSERT INTO colheita.weeks(organization_id,reference_date,start_date,end_date,notes) VALUES(:org,:reference,:start,:end,:notes) RETURNING id").param("org",org).param("reference",reference).param("start",start).param("end",end).param("notes",notes).query(UUID.class).single();return find(org,id,false).orElseThrow();}
    @Override public ClosingBlockers closingBlockers(UUID org,UUID week){long producer=jdbc.sql("""
        SELECT count(*) FROM colheita.producer_orders po WHERE po.organization_id=:org AND po.week_id=:week AND po.ordered_qty>0
        AND NOT EXISTS(SELECT 1 FROM colheita.producer_deliveries pd WHERE pd.organization_id=po.organization_id AND pd.week_id=po.week_id AND pd.producer_id=po.producer_id AND pd.product_id=po.product_id)
        """).param("org",org).param("week",week).query(Long.class).single();long schools=jdbc.sql("""
        SELECT count(DISTINCT so.school_id) FROM colheita.school_orders so WHERE so.organization_id=:org AND so.week_id=:week AND so.ordered_qty>0
        AND NOT EXISTS(SELECT 1 FROM colheita.school_deliveries sd WHERE sd.organization_id=so.organization_id AND sd.week_id=so.week_id AND sd.school_id=so.school_id)
        """).param("org",org).param("week",week).query(Long.class).single();return new ClosingBlockers(producer,schools);}
    @Override public Week close(UUID org,UUID week,UUID user){int changed=jdbc.sql("UPDATE colheita.weeks SET status='FECHADA',closed_at=now(),closed_by_id=:user WHERE organization_id=:org AND id=:id AND status='ABERTA'").param("user",user).param("org",org).param("id",week).update();if(changed==0)throw DomainException.conflict("A semana não está aberta.");return find(org,week,false).orElseThrow();}
    @Override public Week reopen(UUID org,UUID week,UUID user,String reason){if(findOpen(org).isPresent())throw DomainException.conflict("Já existe outra semana aberta.");int changed=jdbc.sql("UPDATE colheita.weeks SET status='ABERTA',closed_at=NULL,closed_by_id=NULL WHERE organization_id=:org AND id=:id AND status='FECHADA'").param("org",org).param("id",week).update();if(changed==0)throw DomainException.conflict("A semana não está fechada.");jdbc.sql("INSERT INTO colheita.week_reopenings(organization_id,week_id,user_id,reason) VALUES(:org,:week,:user,:reason)").param("org",org).param("week",week).param("user",user).param("reason",reason).update();return find(org,week,false).orElseThrow();}
    private Week map(ResultSet rs)throws java.sql.SQLException{var closed=rs.getTimestamp("closed_at");return new Week(rs.getObject("id",UUID.class),rs.getLong("number"),rs.getObject("reference_date",LocalDate.class),rs.getObject("start_date",LocalDate.class),rs.getObject("end_date",LocalDate.class),Status.valueOf(rs.getString("status")),rs.getString("notes"),rs.getTimestamp("created_at").toInstant(),closed==null?null:closed.toInstant(),rs.getObject("closed_by_id",UUID.class));}
}

