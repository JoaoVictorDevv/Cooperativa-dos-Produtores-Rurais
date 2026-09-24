package br.org.colheita.application.service;

import br.org.colheita.application.port.out.ReportPort;
import br.org.colheita.domain.model.Actor;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ReportService {
    private final ReportPort reports;
    public ReportService(ReportPort reports){this.reports=reports;}
    public ReportPort.WeekSummary summary(Actor a,UUID weekId){return reports.weekSummary(a.organizationId(),weekId);}
    public List<Map<String,Object>> audit(Actor a,String type,UUID id,int limit){return reports.audit(a.organizationId(),type,id,Math.min(limit,200));}
}

