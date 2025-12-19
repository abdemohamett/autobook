import { Row, Benchmark } from './types';

/**
 * Calculate Height of Collimation
 * HOC = BM + BS (for first reading)
 * HOC = CP_RL + BS (after change point)
 */
export function calculateHOC(
  row: Row,
  previousHOC: number | null,
  benchmark: Benchmark | undefined
): number | undefined {
  if (!row.bs) return undefined;

  if (previousHOC === null && benchmark) {
    // First reading: HOC = BM + BS
    return benchmark.rl + row.bs;
  } else if (previousHOC !== null) {
    // After change point: HOC = CP_RL + BS
    return previousHOC + row.bs;
  }

  return undefined;
}

/**
 * Calculate Reduced Level
 * RL = HOC - IS (for intermediate sights)
 * RL = HOC - FS (for foresights)
 */
export function calculateRL(row: Row, hoc: number | undefined): number | undefined {
  if (!hoc) return undefined;

  if (row.is !== undefined && row.is !== null) {
    return hoc - row.is;
  }

  if (row.fs !== undefined && row.fs !== null) {
    return hoc - row.fs;
  }

  return undefined;
}

/**
 * Calculate Difference
 * DIFF = D - RL
 */
export function calculateDiff(row: Row): number | undefined {
  if (row.d === undefined || row.d === null || row.rl === undefined || row.rl === null) {
    return undefined;
  }
  return row.d - row.rl;
}

/**
 * Process all rows and calculate values
 */
export function processRows(rows: Row[], benchmark: Benchmark | undefined): Row[] {
  let currentHOC: number | null = null;
  let currentBM: number | null = null;

  // Initialize BM from benchmark
  if (benchmark) {
    currentBM = benchmark.rl;
  }

  return rows.map((row, index) => {
    // Handle closing BM row
    if (row.isClosingBM) {
      const newRow = { ...row };
      // Calculate RL from previous HOC
      if (index > 0 && currentHOC !== null) {
        if (row.fs !== undefined && row.fs !== null) {
          newRow.rl = currentHOC - row.fs;
          // Calculate difference if closing BM value is provided
          if (row.closingBMValue !== undefined) {
            newRow.d = row.closingBMValue;
            newRow.diff = newRow.d - (newRow.rl || 0);
          }
        }
      }
      return newRow;
    }
    
    // Handle CP rows (rows with CP info, not separate divider rows)
    if (row.isCP) {
      const newRow = { ...row };
      
      // Set RL to cpRL for display (old HOC - FS)
      if (row.cpRL !== undefined) {
        newRow.rl = row.cpRL;
      }
      
      // After CP, update BM to CP_RL and HOC to new HOC for next rows
      if (row.cpRL !== undefined) {
        currentBM = row.cpRL;
      }
      if (row.cpHOC !== undefined) {
        currentHOC = row.cpHOC;
      }
      
      return newRow;
    }

    const newRow = { ...row };

    // Calculate HOC
    if (row.bs !== undefined && row.bs !== null) {
      // If we have a BM (from benchmark or CP), use it
      if (currentBM !== null) {
        newRow.hoc = currentBM + row.bs;
        currentHOC = newRow.hoc;
      } else if (currentHOC !== null) {
        // Fallback to previous HOC if no BM
        newRow.hoc = currentHOC;
      }
    } else if (currentHOC !== null) {
      // Carry forward HOC if no BS
      newRow.hoc = currentHOC;
    }

    // Calculate RL
    if (newRow.hoc !== undefined) {
      const rl = calculateRL(newRow, newRow.hoc);
      if (rl !== undefined) {
        newRow.rl = rl;
      }
    }

    // Calculate DIFF
    if (newRow.rl !== undefined) {
      const diff = calculateDiff(newRow);
      if (diff !== undefined) {
        newRow.diff = diff;
      }
    }

    return newRow;
  });
}

/**
 * Add a Change Point
 * When FS is entered in a row, we can add a CP
 * The FS row gets the new BS and chainage is cleared
 * The point row is pushed to the next row after CP
 */
export function addChangePoint(
  rows: Row[],
  fsRowIndex: number,
  newBS: number,
  label?: string,
  benchmark?: Benchmark
): Row[] {
  // Process rows first to get HOC values
  const processedRows = processRows(rows, benchmark);
  const fsRow = processedRows[fsRowIndex];
  
  if (!fsRow || fsRow.fs === undefined || fsRow.fs === null) {
    return rows;
  }

  // Get the old HOC value from the processed row
  // This is the HOC before the CP
  const oldHOC = fsRow.hoc;
  
  if (!oldHOC || oldHOC === null || oldHOC === undefined) {
    // Can't calculate CP without HOC
    return rows;
  }

  // Get the original row (not processed) to preserve chainage and other data
  const originalRow = rows[fsRowIndex];
  
  // Calculate CP RL from the FS row: CP_RL = old HOC - FS
  // This is the RL at the change point
  const cpRL = oldHOC - fsRow.fs;
  
  // New HOC = old HOC - FS + new BS
  // Simplified: New HOC = (old HOC - FS) + new BS = CP_RL + new BS
  const newHOC = oldHOC - fsRow.fs + newBS;

  // Count existing CPs to generate label (format: CP01, CP02, etc.)
  const existingCPs = rows.filter(r => r.isCP).length;
  const cpNumber = existingCPs + 1;
  const cpLabel = label || `CP${String(cpNumber).padStart(2, '0')}`;

  // Update the FS row: add new BS and clear chainage name
  const updatedFsRow: Row = {
    ...originalRow,
    bs: newBS, // Add the new BS to the same row
    chainage: '', // Clear chainage name (no point name)
    // Keep FS as is
  };

  // Create a new row for the point that was on the FS row (push it down)
  // This duplicates the point with new BS
  const pointRow: Row = {
    ...originalRow,
    id: `row-${Date.now()}-pushed`,
    bs: newBS, // Set the new BS
    fs: undefined, // Clear FS
    is: undefined, // Clear IS
    hoc: undefined, // Will be recalculated
    rl: undefined, // Will be recalculated
    diff: undefined, // Will be recalculated
  };

  // Update the FS row with CP info (no separate divider row)
  // Store CP info in the FS row itself
  const updatedFsRowWithCP: Row = {
    ...updatedFsRow,
    isCP: true, // Mark as CP row
    cpLabel,
    cpRL,
    cpHOC: newHOC,
    chainage: cpLabel, // Show CP label in chainage column (will be styled red)
  };

  // Insert only the pushed point row (no CP divider row)
  const newRows = [...rows];
  newRows[fsRowIndex] = updatedFsRowWithCP; // Update FS row with BS, CP info, and CP label
  newRows.splice(fsRowIndex + 1, 0, pointRow); // Insert only the pushed point row

  return newRows;
}

/**
 * Delete a Change Point
 * Removes the CP divider and the pushed point row
 * Restores the original FS row (removes BS, restores chainage)
 */
export function deleteChangePoint(
  rows: Row[],
  cpRowIndex: number
): Row[] {
  // Find the CP row (now it's the FS row itself, not a separate divider)
  const cpRow = rows[cpRowIndex];
  if (!cpRow || !cpRow.isCP) {
    return rows;
  }

  // The structure after CP is added:
  // FS row (with BS, FS, CP info, CP label in chainage) -> pushed point row (with chainage)
  // To delete CP, we need to:
  // 1. Find the pushed point row (after CP row) - it has the original chainage
  // 2. Restore the FS row: remove BS, remove CP info, restore chainage from pushed point
  // 3. Remove the pushed point row

  const pushedPointRowIndex = cpRowIndex + 1;

  if (pushedPointRowIndex >= rows.length) {
    return rows;
  }

  const pushedPointRow = rows[pushedPointRowIndex];

  // Check if pushed point row exists
  if (!pushedPointRow || !pushedPointRow.id.includes('-pushed')) {
    // If no pushed point row, just remove CP info from the row
    const restoredFsRow: Row = {
      ...cpRow,
      bs: undefined, // Remove the BS that was added for CP
      isCP: false, // Remove CP flag
      cpLabel: undefined,
      cpRL: undefined,
      cpHOC: undefined,
      chainage: '', // Clear chainage
    };
    const newRows = [...rows];
    newRows[cpRowIndex] = restoredFsRow;
    return newRows;
  }

  // Restore the FS row: remove BS, remove CP info, restore chainage from pushed point
  const restoredFsRow: Row = {
    ...cpRow,
    bs: undefined, // Remove the BS that was added for CP
    isCP: false, // Remove CP flag
    cpLabel: undefined,
    cpRL: undefined,
    cpHOC: undefined,
    chainage: pushedPointRow.chainage || '', // Restore chainage from pushed point
  };

  // Remove pushed point row, restore FS row
  const newRows = [...rows];
  newRows[cpRowIndex] = restoredFsRow; // Restore FS row
  newRows.splice(pushedPointRowIndex, 1); // Remove pushed point row

  return newRows;
}

