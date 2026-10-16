export interface ScopeLibraryStaticDivision {
  divisionCode: string;
  divisionName: string;
  /** Mirrors the division module's `hasSubDivision` (division-static-data.ts). */
  hasSubDivision?: boolean;
  subDivisions: string[];
}

export interface ScopeLibraryStaticCompany {
  id: string;
  companyName: string;
  divisions: ScopeLibraryStaticDivision[];
}
