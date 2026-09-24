package br.org.colheita.infrastructure.persistence;

import br.org.colheita.application.port.out.AuditPort;
import br.org.colheita.domain.model.Actor;
import tools.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AuditJdbcAdapter implements AuditPort {
    private final JdbcClient jdbc; private final ObjectMapper json;
    public AuditJdbcAdapter(JdbcClient jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
    @Override public void record(Actor actor,String action,String entityType,UUID entityId,Object before,Object after,String reason){
        try{jdbc.sql("""
            INSERT INTO colheita.audit_logs(organization_id,user_id,action,entity_type,entity_id,before_data,after_data,reason)
            VALUES(:org,:user,:action,:type,:entity,CAST(:before AS jsonb),CAST(:after AS jsonb),:reason)
            """).param("org",actor.organizationId()).param("user",actor.userId()).param("action",action).param("type",entityType).param("entity",entityId).param("before",before==null?null:json.writeValueAsString(before)).param("after",after==null?null:json.writeValueAsString(after)).param("reason",reason).update();}catch(Exception e){throw new IllegalStateException("Falha ao registrar auditoria",e);}
    }
}
