export interface ChainagePoint {
  chainage: string; // e.g. "0+000", "0+040"
  offset: number; // e.g. -3.5, 0, 3.5
  displayName: string; // e.g. "3.5 LHS", "2+460 CL", "3.5 RHS"
  chainageType?: 'CL' | 'RD' | 'LHS' | 'RHS'; // For styling
}

export interface Row {
  id: string;
  chainage: string; // Display name for chainage point (e.g. "2+460 CL", "3.5 LHS", "RD4B-14A")
  chainageType?: 'CL' | 'RD' | 'LHS' | 'RHS'; // For styling (CL=green, RD=red)
  bs?: number; // Backsight
  is?: number; // Intermediate sight
  fs?: number; // Foresight
  hoc?: number; // Height of Collimation
  rl?: number; // Reduced Level (Achieved RL)
  d?: number; // Design RL
  diff?: number; // Difference (D - RL)
  isCP?: boolean; // Is this a Change Point divider?
  cpLabel?: string; // CP label (e.g. "CP01")
  cpRL?: number; // CP Reduced Level (old HOC - FS)
  cpHOC?: number; // New HOC after this CP (CP_RL + new BS)
  isClosingBM?: boolean; // Is this a closing BM row?
  closingBMName?: string; // Name of the closing BM
  closingBMValue?: number; // Known value of the closing BM
}

export interface Benchmark {
  name: string;
  rl: number;
}

export interface Project {
  id: string;
  title: string;
  layer: string;
  fromChainage: string; // e.g. "0+000"
  toChainage: string; // e.g. "0+200"
  chainageInterval: number; // Default 20
  pointsPerChainage: number;
  pointPattern?: string[]; // Custom point labels per chainage (e.g. ["4.0 LHS","3.5 LHS","CL","3.5 RHS","4.0 RHS"])
  date: string;
  benchmark?: Benchmark;
  rows: Row[];
  createdAt: number;
  updatedAt: number;
}
