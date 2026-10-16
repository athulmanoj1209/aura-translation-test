/* ── Shared Risk types — import from here in ALL risk components ── */

export type RiskType =
  | 'strategic' | 'operational' | 'financial' | 'compliance'
  | 'it' | 'aml_cft' | 'reputational' | 'other';

export type ControlEffectiveness = 'strong' | 'moderate' | 'weak';
export type RiskStatus = 'open' | 'monitored' | 'closed' | 'deactivated';
export type ResidualLevel = 'low' | 'medium' | 'high';

export interface RiskFile {
  name: string;
  size: number;
  url?: string;
  file?: File;
}

export interface Risk {
  id: string;
  riskType: RiskType;
  title: string;
  description: string;
  company: string;
  division: string;
  subDivision: string;
  impact: number;
  likelihood: number;
  inherentScore: number;
  keyControls?: string;
  controlEffectiveness: ControlEffectiveness;
  residualScore: number;
  residualLevel: ResidualLevel;
  owner: string;
  dateIdentified: Date;
  lastUpdated: Date;
  status: RiskStatus;
  linkedScopes: string[];
  linkedFindings: string[];
  linkedObservations: string[];
  supportingFiles: RiskFile[];
}

/* ── Shared calculation helpers ── */

export function calcInherent(impact: number, likelihood: number): number {
  return impact * likelihood;
}

const EFFECTIVENESS_ADJUSTMENT: Record<ControlEffectiveness, number> = {
  strong: 6, moderate: 3, weak: 0,
};

export function calcResidualScore(inherent: number, ce: ControlEffectiveness): number {
  return Math.max(1, inherent - EFFECTIVENESS_ADJUSTMENT[ce]);
}

export function calcResidualLevel(score: number): ResidualLevel {
  if (score <= 6)  return 'low';
  if (score <= 14) return 'medium';
  return 'high';
}
