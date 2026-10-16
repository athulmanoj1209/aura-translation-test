/** Which head the client page is simulating — a whole division or a single sub-division. */
export interface SimulatedHead {
  kind: 'division' | 'subDivision';
  name: string;
}
