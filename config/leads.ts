import { COLORS } from "@/config/colors";

/**
 * Product configuration of the leads module. Each organization defines its own
 * pipelines and stages from the app; these are the defaults and limits.
 */

export const STAGE_KINDS = ["OPEN", "WON", "LOST"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const STAGE_KIND_LABELS: Record<
  StageKind,
  { label: string; description: string }
> = {
  OPEN: { label: "En curso", description: "El lead sigue abierto" },
  WON: { label: "Ganado", description: "Cierra el lead como ganado" },
  LOST: { label: "Perdido", description: "Cierra el lead como perdido" },
};

export interface DefaultStage {
  name: string;
  color: string;
  kind: StageKind;
  probability: number;
}

/** Pipeline created with every new organization. It can be edited later. */
export const DEFAULT_PIPELINE: { name: string; stages: DefaultStage[] } = {
  name: "Ventas",
  stages: [
    { name: "Nuevo", color: COLORS.gray, kind: "OPEN", probability: 10 },
    { name: "Contactado", color: COLORS.blue, kind: "OPEN", probability: 25 },
    { name: "Propuesta", color: COLORS.amber, kind: "OPEN", probability: 50 },
    { name: "Negociación", color: COLORS.amber, kind: "OPEN", probability: 75 },
    { name: "Ganado", color: COLORS.green, kind: "WON", probability: 100 },
    { name: "Perdido", color: COLORS.red, kind: "LOST", probability: 0 },
  ],
};

/** Starting stages offered when creating an additional pipeline. */
export const NEW_PIPELINE_STAGES: DefaultStage[] = [
  { name: "Por hacer", color: COLORS.gray, kind: "OPEN", probability: 10 },
  { name: "En curso", color: COLORS.blue, kind: "OPEN", probability: 50 },
  { name: "Ganado", color: COLORS.green, kind: "WON", probability: 100 },
  { name: "Perdido", color: COLORS.red, kind: "LOST", probability: 0 },
];

export const LEAD_LIMITS = {
  maxStagesPerPipeline: 15,
  /** Cards loaded per column; the header still shows the full count. */
  cardsPerStage: 100,
  maxTags: 10,
  maxTagLength: 30,
  maxNoteLength: 5000,
  maxValue: 999_999_999_999,
};
