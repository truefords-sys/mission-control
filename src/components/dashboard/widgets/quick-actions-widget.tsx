'use client'

import {
  QuickAction,
  SpawnActionIcon,
  LogActionIcon,
  TaskActionIcon,
  MemoryActionIcon,
  SessionIcon,
  PipelineActionIcon,
  type DashboardData,
} from '../widget-primitives'

export function QuickActionsWidget({ data }: { data: DashboardData }) {
  const { isLocal, navigateToPanel } = data

  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-2">
      {!isLocal && <QuickAction label="Créer un agent" desc="Lancer un sous-agent" tab="spawn" icon={<SpawnActionIcon />} onNavigate={navigateToPanel} />}
      <QuickAction label="Voir les journaux" desc="Visionneuse temps réel" tab="logs" icon={<LogActionIcon />} onNavigate={navigateToPanel} />
      <QuickAction label="Tableau des tâches" desc="Flux et contrôle de file" tab="tasks" icon={<TaskActionIcon />} onNavigate={navigateToPanel} />
      <QuickAction label="Mémoire" desc="Connaissances et rappel" tab="memory" icon={<MemoryActionIcon />} onNavigate={navigateToPanel} />
      {isLocal
        ? <QuickAction label="Sessions" desc="Claude + Codex" tab="sessions" icon={<SessionIcon />} onNavigate={navigateToPanel} />
        : <QuickAction label="Orchestration" desc="Flux de travail et pipelines" tab="agents" icon={<PipelineActionIcon />} onNavigate={navigateToPanel} />}
    </section>
  )
}
