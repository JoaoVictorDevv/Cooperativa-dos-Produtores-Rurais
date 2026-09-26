"use client";

import { useState } from "react";
import { CycleCoreWorkspace } from "@/components/cycle-core/CycleCoreWorkspace";
import { InMemoryCycleCoreRepository } from "@/lib/cycleCore/repository";
import { DEMO_CYCLE_ID, DEMO_NAMES, DEMO_REASONS, buildDemoLedger } from "@/lib/cycleCore/demoScenario";
import type { Actor } from "@/lib/domain/cycleLedger";

const newRepository = () => new InMemoryCycleCoreRepository([buildDemoLedger()]);

export function DemoWorkspace({ actor }: { actor: Actor }) {
  const [repository, setRepository] = useState(newRepository);
  const [round, setRound] = useState(0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      <div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setRepository(newRepository());
            setRound((r) => r + 1);
          }}
        >
          Recomeçar demonstração
        </button>
      </div>
      <CycleCoreWorkspace
        key={round}
        repository={repository}
        cycleId={DEMO_CYCLE_ID}
        actor={actor}
        names={DEMO_NAMES}
        producerIds={Object.keys(DEMO_NAMES.producers)}
        reasonOptions={DEMO_REASONS}
      />
    </div>
  );
}
