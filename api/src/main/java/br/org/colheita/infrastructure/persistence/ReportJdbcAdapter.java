package br.org.colheita.infrastructure.persistence;

import br.org.colheita.application.port.out.ReportPort;
import br.org.colheita.domain.exception.DomainException;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ReportJdbcAdapter implements ReportPort {
    private final JdbcClient jdbc;
    public ReportJdbcAdapter(JdbcClient jdbc){this.jdbc=jdbc;}
    @Override public WeekSummary weekSummary(UUID org,UUID week){return jdbc.sql("""
        SELECT week_id,number,receivable,payable,costs,(receivable-payable-costs) balance
        FROM colheita.v_week_financial_summary WHERE organization_id=:org AND week_id=:week
        """).param("org",org).param("week",week).query((rs,n)->new WeekSummary(rs.getObject("week_id",UUID.class),rs.getLong("number"),rs.getBigDecimal("receivable"),rs.getBigDecimal("payable"),rs.getBigDecimal("costs"),rs.getBigDecimal("balance"))).optional().orElseThrow(()->DomainException.notFound("Semana não encontrada."));}
    @Override public List<Map<String,Object>> audit(UUID org,String entityType,UUID entityId,int limit){String sql="""
        SELECT id,user_id,action,entity_type,entity_id,before_data,after_data,reason,created_at
        FROM colheita.audit_logs WHERE organization_id=:org
        """+(entityType==null?"":" AND entity_type=:type")+(entityId==null?"":" AND entity_id=:entity")+" ORDER BY created_at DESC LIMIT :limit";var query=jdbc.sql(sql).param("org",org).param("limit",limit);if(entityType!=null)query=query.param("type",entityType);if(entityId!=null)query=query.param("entity",entityId);return query.query().listOfRows();}
}
