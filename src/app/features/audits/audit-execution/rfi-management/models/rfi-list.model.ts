import type { ScopeOrgLabels } from '@/app/shared/utils/no-sub-division-message';
import type { EnrichedRFI } from './rfi.model';

// Sub-Division / Scope / Sub-Scope filter option shapes for the RFI list (non-auditor UI)
export type RfiFilterSubScope = { id: number; label: string; value: string; };
export type RfiFilterScope = { id: number; label: string; value: string; subScopes: RfiFilterSubScope[]; };
export type RfiFilterSubDivision = { id: number; label: string; value: string; scopes: RfiFilterScope[]; owners: string[]; };

/** EnrichedRFI + live company / division / sub-division display labels for the cards. */
export type RfiRow = EnrichedRFI & { org: ScopeOrgLabels };
