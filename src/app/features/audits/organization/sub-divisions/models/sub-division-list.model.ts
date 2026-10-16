import type { StaticSubDivision } from './sub-division-static.model';

export interface EnrichedSubDivision extends StaticSubDivision {
  divisionCode: string;
  divisionName: string;
}
