export interface RfiLibraryStaticDivision {
  divisionCode: string;
  divisionName: string;
  /** Mirrors the division module's `hasSubDivision` (division-static-data.ts). */
  hasSubDivision?: boolean;
  subDivisions: string[];
}

export interface RfiLibraryStaticCompany {
  id: string;
  companyName: string;
  divisions: RfiLibraryStaticDivision[];
}
