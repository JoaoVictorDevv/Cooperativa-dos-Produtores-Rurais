package br.org.colheita.application.port.out;

import br.org.colheita.domain.model.CatalogModels.*;
import br.org.colheita.domain.model.PageResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface CatalogPort {
    PageResult<Product> listProducts(UUID orgId, String search, int page, int size);
    Product saveProduct(UUID orgId, UUID id, String slug, String name, String unit, boolean active);
    PageResult<School> listSchools(UUID orgId, String search, int page, int size);
    School saveSchool(UUID orgId, UUID id, String code, String name, String neighborhood, String address, String phone, boolean active);
    PageResult<Producer> listProducers(UUID orgId, String search, int page, int size);
    Producer saveProducer(UUID orgId, UUID id, String internalId, String name, String document, String phone, boolean active);
    PageResult<ReturnReason> listReturnReasons(UUID orgId, String search, int page, int size);
    ReturnReason saveReturnReason(UUID orgId, UUID id, int code, String description, boolean active);
    PageResult<Price> listPrices(UUID orgId, UUID productId, int page, int size);
    Price schedulePrice(UUID orgId, UUID productId, BigDecimal price, Instant validFrom);
}

