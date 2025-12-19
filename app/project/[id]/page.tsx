'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, Row } from '@/lib/types';
import { getProject, saveProject, generateTableRows } from '@/lib/storage';
import { processRows, addChangePoint, deleteChangePoint } from '@/lib/calculations';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [cpRowIndex, setCpRowIndex] = useState<number>(-1);
  const [cpBS, setCpBS] = useState('');
  const [cpLabel, setCpLabel] = useState('');
  const [patternText, setPatternText] = useState('3.5 LHS, CL, 3.5 RHS');
  const [editingBMName, setEditingBMName] = useState(false);
  const [editingBMRL, setEditingBMRL] = useState(false);
  const [bmRLRawInput, setBmRLRawInput] = useState<string>('');
  const [showClosingBM, setShowClosingBM] = useState(false);
  // Store raw input values for intermediate states like "0", ".", "0."
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});

  // Use ref for debounce to avoid recreating
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loaded = getProject(projectId);
    if (loaded) {
      setProject(loaded);
      if (loaded.pointPattern && loaded.pointPattern.length) {
        setPatternText(loaded.pointPattern.join(', '));
      } else {
        setPatternText('3.5 LHS, CL, 3.5 RHS');
      }
    } else {
      router.push('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Optimized save function
  const saveProjectDebounced = useCallback((proj: Project) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProject(proj);
    }, 500);
  }, []);

  // Memoize processed rows to avoid recalculating on every render
  const processedRows = useMemo(() => {
    if (!project || project.rows.length === 0) return [];
    return processRows(project.rows, project.benchmark);
  }, [project]);

  const updateProject = useCallback((updates: Partial<Project>) => {
    setProject((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveProjectDebounced(updated);
      return updated;
    });
  }, [saveProjectDebounced]);

  const updateRow = useCallback((rowId: string, updates: Partial<Row>) => {
    setProject((prev) => {
      if (!prev) return prev;
      const updatedRows = prev.rows.map((row) =>
        row.id === rowId ? { ...row, ...updates } : row
      );
      const updated = { ...prev, rows: updatedRows };
      saveProjectDebounced(updated);
      return updated;
    });
  }, [saveProjectDebounced]);

  // Helper to parse number allowing "0", ".", "0.", "3." etc (important for surveying)
  const parseSurveyNumber = useCallback((value: string): number | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    // Allow intermediate states: ".", "0", "0.", "3.", etc - return undefined but allow typing
    // Check if it ends with just a dot (like "3." or "0.")
    if (value === '.' || value.endsWith('.') && value.split('.').length === 2) {
      // Check if the part before dot is a valid number
      const beforeDot = value.slice(0, -1);
      if (beforeDot === '' || /^-?\d+$/.test(beforeDot)) {
        return undefined; // Still typing, don't parse yet
      }
    }
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }, []);

  // Get display value for input (shows raw input or stored number)
  // Always prefer raw input if it exists (allows "00", "000", etc.)
  const getInputValue = useCallback((rowId: string, field: 'bs' | 'is' | 'fs' | 'd', storedValue?: number): string => {
    const key = `${rowId}-${field}`;
    // Always show raw input if it exists (preserves "00", "000", etc.)
    if (rawInputs[key] !== undefined && rawInputs[key] !== '') {
      return rawInputs[key];
    }
    return storedValue !== undefined && storedValue !== null ? String(storedValue) : '';
  }, [rawInputs]);

  // Update input value (stores raw string and parsed number)
  // Keep raw input flexible - allow "00", "000", etc.
  const updateInputValue = useCallback((rowId: string, field: 'bs' | 'is' | 'fs' | 'd', value: string) => {
    const key = `${rowId}-${field}`;
    // Always store raw input - keep it flexible for any number pattern
    setRawInputs(prev => ({ ...prev, [key]: value }));
    
    // Parse and update row in background (but keep raw input for display)
    const parsed = parseSurveyNumber(value);
    if (parsed !== undefined) {
      updateRow(rowId, { [field]: parsed });
    } else if (value === '') {
      // Clear stored value when empty
      updateRow(rowId, { [field]: undefined });
      setRawInputs(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    // Don't clear raw input - keep it so user can type "00", "000", etc.
  }, [parseSurveyNumber, updateRow]);

  const handleFirstRowBS = useCallback((rowId: string, value: string) => {
    updateInputValue(rowId, 'bs', value);
  }, [updateInputValue]);

  const handleMakeCP = (rowIndex: number) => {
    setCpRowIndex(rowIndex);
    setCpBS('');
    setCpLabel('');
  };

  const handleConfirmCP = () => {
    if (!project || cpRowIndex < 0 || !cpBS) return;

    const newBS = parseFloat(cpBS);
    if (isNaN(newBS)) return;

    // Add CP - this will push the point to next row
    const updatedRows = addChangePoint(
      project.rows, 
      cpRowIndex, 
      newBS, 
      cpLabel || undefined,
      project.benchmark
    );
    
    setProject((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, rows: updatedRows };
      saveProjectDebounced(updated);
      return updated;
    });
    
    setCpRowIndex(-1);
    setCpBS('');
    setCpLabel('');
  };

  const handleCancelCP = () => {
    setCpRowIndex(-1);
    setCpBS('');
    setCpLabel('');
  };

  const handleDeleteCP = useCallback((cpRowIndex: number) => {
    if (!project) return;
    
    // Find the CP row in processed rows
    const cpRow = processedRows[cpRowIndex];
    if (!cpRow || !cpRow.isCP) return;

    // Find the index in the original rows array
    const originalIndex = project.rows.findIndex(r => r.id === cpRow.id);
    if (originalIndex === -1) return;

    const updatedRows = deleteChangePoint(project.rows, originalIndex);
    
    setProject((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, rows: updatedRows };
      saveProjectDebounced(updated);
      return updated;
    });
  }, [project, processedRows, saveProjectDebounced]);


  // Use project title or generate from data
  const headerTitle = project?.title || (project 
    ? `LEVEL CHECK FROM ${project.fromChainage} TO ${project.toChainage} FOR ${project.layer.toUpperCase()}`
    : '');

  const handleApplyPattern = useCallback(() => {
    if (!project) return;
    const parsed = patternText
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parsed.length === 0) return;

    // Regenerate rows with new pattern; preserve BM row (index 0)
    const regenerated = generateTableRows({
      ...project,
      pointPattern: parsed,
    });
    const bmRow = project.rows[0] || regenerated[0];
    const newRows = [bmRow, ...regenerated.slice(1)];

    const updatedProject = {
      ...project,
      pointPattern: parsed,
      rows: newRows,
    };
    setProject(updatedProject);
    saveProjectDebounced(updatedProject);
  }, [patternText, project, saveProjectDebounced]);

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const hasRows = project.rows.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Orange Header Bar */}
      <header className="sticky top-0 z-20 bg-orange-500 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {editingField === 'title' ? (
              <Input
                type="text"
                value={project.title}
                onChange={(e) => updateProject({ title: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="text-base font-semibold bg-white text-gray-900"
                autoFocus
              />
            ) : (
              <h1
                className="text-base font-semibold cursor-pointer"
                onClick={() => setEditingField('title')}
              >
                {headerTitle}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowClosingBM(true)}
              variant="outline"
              size="sm"
              disabled={processedRows.some(r => r.isClosingBM)}
              className="text-xs h-8"
            >
              Close with BM
            </Button>
            <Button
              onClick={() => setShowClosingBM(true)}
              variant="outline"
              size="sm"
              disabled={processedRows.some(r => r.isClosingBM)}
              className="text-xs h-8"
            >
              Close with BM
            </Button>
            {editingField === 'date' ? (
              <Input
                type="date"
                value={project.date}
                onChange={(e) => updateProject({ date: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="h-8 text-sm bg-white text-gray-900"
                autoFocus
              />
            ) : (
              <span
                className="text-sm cursor-pointer"
                onClick={() => setEditingField('date')}
              >
                Date: {new Date(project.date).toLocaleDateString('en-GB')}
              </span>
            )}
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-orange-600 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-2 sm:px-4 py-4 sm:py-6">
        {/* Save indicator */}
        <div className="mb-2 text-xs text-gray-400 text-right">
          Saved locally ✓
        </div>

        {/* Points pattern editor */}
        <div className="mb-4 p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-600 mb-1">
                Points pattern (comma separated)
              </label>
              <Input
                type="text"
                value={patternText}
                onChange={(e) => setPatternText(e.target.value)}
                className="w-full h-10 text-xs sm:text-sm"
                placeholder="e.g. 4.0 LHS, 3.5 LHS, CL, 3.5 RHS, 4.0 RHS"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Use “CL” for center (green), any labels for sides (e.g., “4.0 LHS”, “3.5 RHS”, “RD4B-14A”).
              </p>
            </div>
            <Button
              type="button"
              onClick={handleApplyPattern}
              className="h-10 px-3 text-sm whitespace-nowrap"
              variant="secondary"
            >
              Apply pattern
            </Button>
          </div>
        </div>

        {/* Table - Mobile Optimized */}
        {hasRows && (
          <div className="overflow-x-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[70px] sm:min-w-[70px] text-[10px] sm:text-xs">BS</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[70px] sm:min-w-[70px] text-[10px] sm:text-xs">IS</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[70px] sm:min-w-[70px] text-[10px] sm:text-xs">FS</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[80px] sm:min-w-[80px] text-[10px] sm:text-xs">HOC</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[80px] sm:min-w-[80px] text-[10px] sm:text-xs">RL</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[70px] sm:min-w-[70px] text-[10px] sm:text-xs">D</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[100px] sm:min-w-[100px] text-[10px] sm:text-xs">CH</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700 min-w-[70px] sm:min-w-[70px] text-[10px] sm:text-xs">DIFF</th>
                </tr>
              </thead>
              <tbody>
                {processedRows.map((row, index) => {
                  const isCPRow = cpRowIndex === index;
                  const isCPDataRow = row.isCP && !isCPRow; // CP row that has been confirmed (not the editing row)
                  const isFirstRow = index === 0;
                  const isCLRow = row.chainageType === 'CL';
                  const isRDRow = row.chainage?.startsWith('RD') || row.chainage?.includes('RD');

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        isRDRow ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="p-1 sm:p-2">
                        {isCPRow ? (
                          // CP row: Show new BS input (will be saved when CP is confirmed)
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={cpBS}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow any numeric pattern: 00, 000, 0.00, etc. - be very flexible
                            if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
                            setCpBS(val);
                          }}
                          className="w-full h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-blue-50 border-blue-300 placeholder:text-gray-400 focus:bg-white focus:border-blue-400 text-right font-mono whitespace-nowrap"
                            placeholder="New BS"
                          />
                        ) : (
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={getInputValue(row.id, 'bs', row.bs)}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow any numeric pattern: 00, 000, 0.00, etc. - be very flexible
                              // Only block if it's clearly not a number pattern
                              if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
                              if (isFirstRow) {
                                handleFirstRowBS(row.id, val);
                              } else {
                                updateInputValue(row.id, 'bs', val);
                              }
                            }}
                            className="w-full h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-gray-50 border-gray-200 placeholder:text-gray-400 focus:bg-white focus:border-gray-400 text-right font-mono whitespace-nowrap"
                            placeholder=""
                          />
                        )}
                      </td>
                      <td className="p-1 sm:p-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={getInputValue(row.id, 'is', row.is)}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow any numeric pattern: 00, 000, 0.00, etc. - be very flexible
                              if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
                              updateInputValue(row.id, 'is', val);
                            }}
                          className="w-full h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-gray-50 border-gray-200 placeholder:text-gray-400 focus:bg-white focus:border-gray-400 text-right font-mono whitespace-nowrap"
                          placeholder=""
                        />
                      </td>
                      <td className="p-1 sm:p-2">
                        <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getInputValue(row.id, 'fs', row.fs)}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Allow any numeric pattern: 00, 000, 0.00, etc. - be very flexible
                                if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
                                updateInputValue(row.id, 'fs', val);
                              }}
                              className="flex-1 h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-gray-50 border-gray-200 placeholder:text-gray-400 focus:bg-white focus:border-gray-400 text-right font-mono whitespace-nowrap"
                              placeholder=""
                            />
                            {row.fs !== undefined && row.fs !== null && !isCPRow && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleMakeCP(index)}
                                className="h-10 sm:h-11 px-1.5 sm:px-2 text-[10px] sm:text-xs min-h-[44px] whitespace-nowrap"
                              >
                                CP
                              </Button>
                            )}
                          </div>
                          {isCPRow && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                  type="text"
                                  value={cpLabel}
                                  onChange={(e) => setCpLabel(e.target.value)}
                                  placeholder="Label (optional)"
                                  className="flex-1 h-9 sm:h-8 text-xs sm:text-sm"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelCP}
                                  className="flex-1 h-9 sm:h-8 text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleConfirmCP}
                                  className="flex-1 h-9 sm:h-8 text-xs"
                                  disabled={!cpBS}
                                >
                                  Add CP
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-1 sm:p-2">
                        <div className="px-1 sm:px-2 py-1 text-gray-700 h-10 sm:h-11 flex items-center text-xs sm:text-sm font-mono whitespace-nowrap">
                          {isCPDataRow
                            ? (row.cpHOC !== undefined ? row.cpHOC.toFixed(3) : '—')
                            : (isFirstRow && row.bs !== undefined && row.bs !== null)
                              ? (row.hoc?.toFixed(3) || '—')
                              : '—'}
                        </div>
                      </td>
                      <td className="p-1 sm:p-2">
                        {isFirstRow ? (
                          // First row: BM RL input (editable)
                          editingBMRL ? (
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={bmRLRawInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Allow any numeric pattern: 00, 000, 0.00, 23.101, etc. - be very flexible
                                if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
                                
                                // Always store raw input - don't clear it while typing
                                setBmRLRawInput(val);
                                
                                // Parse and update in background (but keep raw input for display)
                                if (val !== '') {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    // Update the stored value in background
                                    if (project.benchmark) {
                                      updateProject({
                                        benchmark: {
                                          name: project.benchmark.name,
                                          rl: parsed,
                                        },
                                      });
                                    } else {
                                      updateProject({
                                        benchmark: {
                                          name: 'BM1',
                                          rl: parsed,
                                        },
                                      });
                                    }
                                  }
                                } else {
                                  // Clear BM RL if empty
                                  if (project.benchmark) {
                                    updateProject({
                                      benchmark: {
                                        name: project.benchmark.name,
                                        rl: 0,
                                      },
                                    });
                                  }
                                }
                              }}
                              onBlur={() => {
                                setEditingBMRL(false);
                                // Final parse on blur to ensure we have the correct value
                                if (bmRLRawInput && bmRLRawInput !== '') {
                                  const parsed = parseFloat(bmRLRawInput);
                                  if (!isNaN(parsed)) {
                                    if (project.benchmark) {
                                      updateProject({
                                        benchmark: {
                                          name: project.benchmark.name,
                                          rl: parsed,
                                        },
                                      });
                                    } else {
                                      updateProject({
                                        benchmark: {
                                          name: 'BM1',
                                          rl: parsed,
                                        },
                                      });
                                    }
                                    // Set to formatted value on blur
                                    setBmRLRawInput(parsed.toFixed(3));
                                  } else {
                                    // If invalid, restore previous value
                                    if (project.benchmark?.rl !== undefined) {
                                      setBmRLRawInput(project.benchmark.rl.toFixed(3));
                                    } else {
                                      setBmRLRawInput('');
                                    }
                                  }
                                } else {
                                  // If empty, keep previous value
                                  if (project.benchmark?.rl !== undefined) {
                                    setBmRLRawInput(project.benchmark.rl.toFixed(3));
                                  } else {
                                    setBmRLRawInput('');
                                  }
                                }
                              }}
                              onFocus={() => {
                                // When focusing, show the current value as editable
                                if (project.benchmark?.rl !== undefined) {
                                  setBmRLRawInput(String(project.benchmark.rl));
                                } else {
                                  setBmRLRawInput('');
                                }
                              }}
                              className="w-full h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-blue-50 border-blue-300 focus:bg-white focus:border-blue-400"
                              placeholder=""
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => {
                                setEditingBMRL(true);
                                if (project.benchmark?.rl !== undefined) {
                                  setBmRLRawInput(String(project.benchmark.rl));
                                }
                              }}
                              className="px-1 sm:px-2 py-1 text-gray-700 h-10 sm:h-11 flex items-center cursor-pointer bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-xs sm:text-sm"
                            >
                              {project.benchmark?.rl !== undefined ? project.benchmark.rl.toFixed(3) : 'Click to set BM RL'}
                            </div>
                          )
                        ) : isCPDataRow ? (
                          // CP row: Show CP_RL (old HOC - FS) in RL column
                          <div className="px-1 sm:px-2 py-1 text-gray-700 h-10 sm:h-11 flex items-center text-xs sm:text-sm font-semibold font-mono whitespace-nowrap">
                            {row.cpRL !== undefined ? row.cpRL.toFixed(3) : '—'}
                          </div>
                        ) : (
                          // Other rows: calculated RL (always show with 3 decimals)
                          <div className="px-1 sm:px-2 py-1 text-gray-700 h-10 sm:h-11 flex items-center text-xs sm:text-sm font-mono whitespace-nowrap">
                            {row.rl !== undefined && row.rl !== null ? row.rl.toFixed(3) : '—'}
                          </div>
                        )}
                      </td>
                      <td className="p-1 sm:p-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={getInputValue(row.id, 'd', row.d)}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow any numeric pattern: 00, 000, 0.00, etc. - be very flexible
                            if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
                            updateInputValue(row.id, 'd', val);
                          }}
                          className="w-full h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-gray-50 border-gray-200 placeholder:text-gray-400 focus:bg-white focus:border-gray-400 text-right font-mono whitespace-nowrap"
                          placeholder=""
                        />
                      </td>
                      <td className="p-1 sm:p-2">
                        {isFirstRow ? (
                          // First row: BM Name input only (dedicated BM row)
                          editingBMName ? (
                            <Input
                              type="text"
                              value={project.benchmark?.name || ''}
                              onChange={(e) => {
                                const name = e.target.value;
                                if (project.benchmark) {
                                  updateProject({
                                    benchmark: {
                                      name,
                                      rl: project.benchmark.rl,
                                    },
                                  });
                                } else {
                                  // If no BM exists, create one with default RL
                                  updateProject({
                                    benchmark: {
                                      name,
                                      rl: 0,
                                    },
                                  });
                                  setEditingBMRL(true);
                                }
                              }}
                              onBlur={() => setEditingBMName(false)}
                              className="w-full h-10 sm:h-11 text-xs sm:text-sm min-h-[44px] bg-blue-50 border-blue-300 focus:bg-white"
                              placeholder="e.g. RD4B-14A"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingBMName(true)}
                              className={`px-1 sm:px-2 py-1 text-gray-700 font-medium h-10 sm:h-11 flex items-center cursor-pointer rounded border text-xs sm:text-sm ${
                                project.benchmark
                                  ? 'bg-blue-50 hover:bg-blue-100 border-blue-200'
                                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                              }`}
                            >
                              <span className="truncate">{project.benchmark?.name || 'BM Name'}</span>
                            </div>
                          )
                        ) : isCPDataRow ? (
                          // CP row: Show CP label in red with delete (HOC shown in HOC column)
                          <div className="px-1 sm:px-2 py-1 h-10 sm:h-11 flex items-center justify-between gap-2">
                            <span className="text-red-600 font-semibold text-xs sm:text-sm truncate">
                              {row.cpLabel || 'CP'} New
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCP(index)}
                              className="h-7 sm:h-8 px-1.5 sm:px-2 text-xs bg-red-50 hover:bg-red-100 border-red-300 text-red-700 shrink-0"
                              title="Delete CP"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        ) : (
                          // Other rows: chainage display (chainage points start from row 1)
                          <div className={`px-1 sm:px-2 py-1 text-gray-700 font-medium h-10 sm:h-11 flex items-center text-xs sm:text-sm ${
                            isCLRow ? 'bg-green-100' : ''
                          }`}>
                            {row.chainage}
                          </div>
                        )}
                      </td>
                      <td className="p-1 sm:p-2">
                        <div className="px-1 sm:px-2 py-1 text-gray-700 h-10 sm:h-11 flex items-center text-xs sm:text-sm">
                          {row.diff !== undefined ? row.diff.toFixed(3) : '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!hasRows && (
          <div className="text-center py-12 text-gray-500">
            <p>No table data available</p>
          </div>
        )}
      </main>
    </div>
  );
}
