package br.org.colheita.infrastructure.persistence;

import br.org.colheita.application.port.out.OperationPort;
import br.org.colheita.domain.exception.DomainException;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class OperationJdbcAdapter implements OperationPort {
    private static final Map<String,String> TABLES=Map.of(
        "school-orders","school_orders","school-deliveries","school_deliveries","school-returns","school_returns",
        "producer-allocations","producer_allocations","producer-orders","producer_orders","producer-deliveries","producer_deliveries",
        "producer-returns","producer_returns","weekly-costs","weekly_costs");
    private final JdbcClient jdbc;
    public OperationJdbcAdapter(JdbcClient jdbc){this.jdbc=jdbc;}
    @Override public List<Map<String,Object>> list(UUID org,UUID week,String resource){String table=TABLES.get(resource);if(table==null)throw DomainException.notFound("Recurso operacional inválido.");return jdbc.sql("SELECT * FROM colheita."+table+" WHERE organization_id=:org AND week_id=:week ORDER BY created_at").param("org",org).param("week",week).query().listOfRows();}
    @Override public UUID upsertSchoolOrder(UUID org,UUID week,SchoolOrder c){return jdbc.sql("""
        INSERT INTO colheita.school_orders(organization_id,week_id,school_id,product_id,ordered_qty,price_id)
        VALUES(:org,:week,:school,:product,:qty,:price) ON CONFLICT(organization_id,week_id,school_id,product_id)
        DO UPDATE SET ordered_qty=EXCLUDED.ordered_qty,price_id=EXCLUDED.price_id RETURNING id
        """).param("org",org).param("week",week).param("school",c.schoolId()).param("product",c.productId()).param("qty",c.quantity()).param("price",c.priceId()).query(UUID.class).single();}
    @Override public UUID upsertSchoolDelivery(UUID org,UUID week,SchoolDelivery c){return jdbc.sql("""
        INSERT INTO colheita.school_deliveries(organization_id,week_id,school_id,weekday,delivered_at,note)
        VALUES(:org,:week,:school,CAST(:weekday AS colheita.delivery_weekday),:at,:note)
        ON CONFLICT(organization_id,week_id,school_id) DO UPDATE SET weekday=EXCLUDED.weekday,delivered_at=EXCLUDED.delivered_at,note=EXCLUDED.note RETURNING id
        """).param("org",org).param("week",week).param("school",c.schoolId()).param("weekday",c.weekday()).param("at",c.deliveredAt()).param("note",c.note()).query(UUID.class).single();}
    @Override public UUID upsertSchoolReturn(UUID org,UUID week,SchoolReturn c){return jdbc.sql("""
        INSERT INTO colheita.school_returns(organization_id,week_id,school_id,product_id,returned_qty,return_reason_id)
        VALUES(:org,:week,:school,:product,:qty,:reason) ON CONFLICT(organization_id,week_id,school_id,product_id)
        DO UPDATE SET returned_qty=EXCLUDED.returned_qty,return_reason_id=EXCLUDED.return_reason_id RETURNING id
        """).param("org",org).param("week",week).param("school",c.schoolId()).param("product",c.productId()).param("qty",c.quantity()).param("reason",c.reasonId()).query(UUID.class).single();}
    @Override public UUID upsertProducerAllocation(UUID org,UUID week,ProducerAllocation c){return jdbc.sql("""
        INSERT INTO colheita.producer_allocations(organization_id,week_id,producer_id,product_id,allocated_qty)
        VALUES(:org,:week,:producer,:product,:qty) ON CONFLICT(organization_id,week_id,producer_id,product_id)
        DO UPDATE SET allocated_qty=EXCLUDED.allocated_qty RETURNING id
        """).param("org",org).param("week",week).param("producer",c.producerId()).param("product",c.productId()).param("qty",c.quantity()).query(UUID.class).single();}
    @Override public UUID upsertProducerOrder(UUID org,UUID week,ProducerOrder c){return jdbc.sql("""
        INSERT INTO colheita.producer_orders(organization_id,week_id,producer_id,product_id,ordered_qty,price_id)
        VALUES(:org,:week,:producer,:product,:qty,:price) ON CONFLICT(organization_id,week_id,producer_id,product_id)
        DO UPDATE SET ordered_qty=EXCLUDED.ordered_qty,price_id=EXCLUDED.price_id RETURNING id
        """).param("org",org).param("week",week).param("producer",c.producerId()).param("product",c.productId()).param("qty",c.quantity()).param("price",c.priceId()).query(UUID.class).single();}
    @Override public UUID upsertProducerDelivery(UUID org,UUID week,ProducerDelivery c){return jdbc.sql("""
        INSERT INTO colheita.producer_deliveries(organization_id,week_id,producer_id,product_id,delivered_qty,delivered_at,price_id,logistics_deduction_snapshot)
        VALUES(:org,:week,:producer,:product,:qty,:at,:price,:deduction) ON CONFLICT(organization_id,week_id,producer_id,product_id)
        DO UPDATE SET delivered_qty=EXCLUDED.delivered_qty,delivered_at=EXCLUDED.delivered_at,price_id=EXCLUDED.price_id,logistics_deduction_snapshot=EXCLUDED.logistics_deduction_snapshot RETURNING id
        """).param("org",org).param("week",week).param("producer",c.producerId()).param("product",c.productId()).param("qty",c.quantity()).param("at",c.deliveredAt()).param("price",c.priceId()).param("deduction",c.logisticsDeduction()).query(UUID.class).single();}
    @Override public UUID upsertProducerReturn(UUID org,UUID week,ProducerReturn c){return jdbc.sql("""
        INSERT INTO colheita.producer_returns(organization_id,week_id,producer_id,product_id,returned_qty,return_reason_id)
        VALUES(:org,:week,:producer,:product,:qty,:reason) ON CONFLICT(organization_id,week_id,producer_id,product_id)
        DO UPDATE SET returned_qty=EXCLUDED.returned_qty,return_reason_id=EXCLUDED.return_reason_id RETURNING id
        """).param("org",org).param("week",week).param("producer",c.producerId()).param("product",c.productId()).param("qty",c.quantity()).param("reason",c.reasonId()).query(UUID.class).single();}
    @Override public UUID upsertWeeklyCost(UUID org,UUID week,WeeklyCost c){return jdbc.sql("""
        INSERT INTO colheita.weekly_costs(organization_id,week_id,category,amount)
        VALUES(:org,:week,CAST(:category AS colheita.cost_category),:amount) ON CONFLICT(organization_id,week_id,category)
        DO UPDATE SET amount=EXCLUDED.amount RETURNING id
        """).param("org",org).param("week",week).param("category",c.category()).param("amount",c.amount()).query(UUID.class).single();}
}

