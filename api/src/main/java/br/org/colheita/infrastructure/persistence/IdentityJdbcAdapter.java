package br.org.colheita.infrastructure.persistence;

import br.org.colheita.application.port.out.IdentityPort;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.*;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class IdentityJdbcAdapter implements IdentityPort {
    private final JdbcClient jdbc;
    public IdentityJdbcAdapter(JdbcClient jdbc){this.jdbc=jdbc;}

    @Override public Optional<LoginIdentity> findForLogin(String email,String slug){
        String sql="""
            SELECT u.id,u.name,u.email,u.password_hash,(u.active AND om.active) active,u.locked_until,
                   o.id organization_id,o.trade_name organization_name,r.code role
              FROM colheita.users u JOIN colheita.organization_members om ON om.user_id=u.id
              JOIN colheita.organizations o ON o.id=om.organization_id JOIN colheita.roles r ON r.id=om.role_id
             WHERE u.email=:email AND o.active
            """+(slug==null?"":" AND o.slug=:slug")+"""
             ORDER BY om.created_at LIMIT 1
            """;
        var statement=jdbc.sql(sql).param("email",email);
        if(slug!=null)statement=statement.param("slug",slug);
        return statement.query((rs,n)->mapIdentity(rs)).optional();
    }
    @Override public Optional<LoginIdentity> findIdentity(UUID userId,UUID orgId){
        return jdbc.sql("""
            SELECT u.id,u.name,u.email,u.password_hash,(u.active AND om.active) active,u.locked_until,
                   o.id organization_id,o.trade_name organization_name,r.code role
            FROM colheita.users u JOIN colheita.organization_members om ON om.user_id=u.id
            JOIN colheita.organizations o ON o.id=om.organization_id JOIN colheita.roles r ON r.id=om.role_id
            WHERE u.id=:uid AND o.id=:oid AND o.active
            """).param("uid",userId).param("oid",orgId).query((rs,n)->mapIdentity(rs)).optional();
    }
    private LoginIdentity mapIdentity(ResultSet rs) throws java.sql.SQLException {
        UUID userId=rs.getObject("id",UUID.class),orgId=rs.getObject("organization_id",UUID.class);
        Set<String> permissions=new HashSet<>(jdbc.sql("""
            SELECT p.code FROM colheita.organization_members om JOIN colheita.role_permissions rp ON rp.role_id=om.role_id
            JOIN colheita.permissions p ON p.id=rp.permission_id WHERE om.user_id=:uid AND om.organization_id=:oid AND om.active
            """).param("uid",userId).param("oid",orgId).query(String.class).list());
        return new LoginIdentity(userId,rs.getString("name"),rs.getString("email"),rs.getString("password_hash"),rs.getBoolean("active"),instant(rs,"locked_until"),orgId,rs.getString("organization_name"),RoleCode.valueOf(rs.getString("role")),permissions);
    }
    @Override public void registerLoginSuccess(UUID userId){jdbc.sql("UPDATE colheita.users SET last_login_at=now(),failed_login_attempts=0,locked_until=NULL WHERE id=:id").param("id",userId).update();}
    @Override public void registerLoginFailure(UUID userId,int max,Instant lockedUntil){jdbc.sql("""
        UPDATE colheita.users SET failed_login_attempts=failed_login_attempts+1,
        locked_until=CASE WHEN failed_login_attempts+1>=:max THEN :until ELSE locked_until END WHERE id=:id
        """).param("max",max).param("until",lockedUntil).param("id",userId).update();}
    @Override public PageResult<UserView> listUsers(UUID orgId,String search,int page,int size){String q=search==null?"":search.trim();long total=jdbc.sql("""
        SELECT count(*) FROM colheita.organization_members om JOIN colheita.users u ON u.id=om.user_id
        WHERE om.organization_id=:org AND (:q='' OR u.name ILIKE '%'||:q||'%' OR u.email ILIKE '%'||:q||'%')
        """).param("org",orgId).param("q",q).query(Long.class).single();List<UserView> items=jdbc.sql("""
        SELECT u.id,u.name,u.email,om.active,r.code role,u.last_login_at,u.created_at
        FROM colheita.organization_members om JOIN colheita.users u ON u.id=om.user_id JOIN colheita.roles r ON r.id=om.role_id
        WHERE om.organization_id=:org AND (:q='' OR u.name ILIKE '%'||:q||'%' OR u.email ILIKE '%'||:q||'%')
        ORDER BY u.name LIMIT :size OFFSET :offset
        """).param("org",orgId).param("q",q).param("size",size).param("offset",page*size).query((rs,n)->userView(rs)).list();return new PageResult<>(items,total,page,size);}
    @Override public UserView createUser(UUID orgId,NewUser input){UUID userId=jdbc.sql("""
        INSERT INTO colheita.users(name,email,password_hash,email_verified_at) VALUES(:name,:email,:hash,now())
        ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id
        """).param("name",input.name()).param("email",input.email()).param("hash",input.passwordHash()).query(UUID.class).single();jdbc.sql("""
        INSERT INTO colheita.organization_members(organization_id,user_id,role_id)
        SELECT :org,:uid,id FROM colheita.roles WHERE code=:role
        ON CONFLICT(organization_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id,active=true
        """).param("org",orgId).param("uid",userId).param("role",input.role().name()).update();return getUser(orgId,userId);}
    @Override public UserView updateUser(UUID orgId,UUID userId,String name,RoleCode role,boolean active){jdbc.sql("UPDATE colheita.users SET name=:name WHERE id=:uid AND EXISTS(SELECT 1 FROM colheita.organization_members WHERE organization_id=:org AND user_id=:uid)").param("name",name).param("uid",userId).param("org",orgId).update();int changed=jdbc.sql("""
        UPDATE colheita.organization_members SET role_id=(SELECT id FROM colheita.roles WHERE code=:role),active=:active
        WHERE organization_id=:org AND user_id=:uid
        """).param("role",role.name()).param("active",active).param("org",orgId).param("uid",userId).update();if(changed==0)throw DomainException.notFound("Usuário não encontrado.");return getUser(orgId,userId);}
    @Override public void updatePassword(UUID orgId,UUID userId,String hash){int changed=jdbc.sql("""
        UPDATE colheita.users SET password_hash=:hash,password_changed_at=now()
        WHERE id=:uid AND EXISTS(SELECT 1 FROM colheita.organization_members WHERE organization_id=:org AND user_id=:uid)
        """).param("hash",hash).param("uid",userId).param("org",orgId).update();if(changed==0)throw DomainException.notFound("Usuário não encontrado.");jdbc.sql("UPDATE colheita.refresh_tokens SET revoked_at=now() WHERE user_id=:uid AND revoked_at IS NULL").param("uid",userId).update();}
    @Override public long activeAdminCount(UUID orgId){return jdbc.sql("""
        SELECT count(*) FROM colheita.organization_members om JOIN colheita.roles r ON r.id=om.role_id
        WHERE om.organization_id=:org AND om.active AND r.code='ADMIN'
        """).param("org",orgId).query(Long.class).single();}
    private UserView getUser(UUID org,UUID id){return jdbc.sql("""
        SELECT u.id,u.name,u.email,om.active,r.code role,u.last_login_at,u.created_at FROM colheita.organization_members om
        JOIN colheita.users u ON u.id=om.user_id JOIN colheita.roles r ON r.id=om.role_id WHERE om.organization_id=:org AND u.id=:id
        """).param("org",org).param("id",id).query((rs,n)->userView(rs)).optional().orElseThrow(()->DomainException.notFound("Usuário não encontrado."));}
    private UserView userView(ResultSet rs)throws java.sql.SQLException{return new UserView(rs.getObject("id",UUID.class),rs.getString("name"),rs.getString("email"),rs.getBoolean("active"),RoleCode.valueOf(rs.getString("role")),instant(rs,"last_login_at"),rs.getTimestamp("created_at").toInstant());}
    @Override public void saveRefreshToken(UUID id,UUID userId,UUID orgId,String hash,Instant expires,String agent,String ip){jdbc.sql("INSERT INTO colheita.refresh_tokens(id,user_id,organization_id,token_hash,expires_at,user_agent,ip_address) VALUES(:id,:uid,:org,:hash,:exp,:agent,CAST(:ip AS inet))").param("id",id).param("uid",userId).param("org",orgId).param("hash",hash).param("exp",expires).param("agent",agent).param("ip",ip).update();}
    @Override public Optional<RefreshSession> findRefreshToken(String hash){return jdbc.sql("SELECT id,user_id,organization_id,expires_at,revoked_at FROM colheita.refresh_tokens WHERE token_hash=:hash").param("hash",hash).query((rs,n)->new RefreshSession(rs.getObject("id",UUID.class),rs.getObject("user_id",UUID.class),rs.getObject("organization_id",UUID.class),rs.getTimestamp("expires_at").toInstant(),instant(rs,"revoked_at"))).optional();}
    @Override public void rotateRefreshToken(UUID current,UUID replacement){jdbc.sql("UPDATE colheita.refresh_tokens SET revoked_at=now(),replaced_by=:replacement WHERE id=:id AND revoked_at IS NULL").param("replacement",replacement).param("id",current).update();}
    @Override public void revokeRefreshToken(String hash){jdbc.sql("UPDATE colheita.refresh_tokens SET revoked_at=now() WHERE token_hash=:hash AND revoked_at IS NULL").param("hash",hash).update();}
    private static Instant instant(ResultSet rs,String column)throws java.sql.SQLException{var ts=rs.getTimestamp(column);return ts==null?null:ts.toInstant();}
}
