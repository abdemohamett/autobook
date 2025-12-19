import { Project, Row } from './types';
import { generateChainagePoints } from './chainage';

const STORAGE_KEY = 'autobook_projects';

/**
 * Get all projects from localStorage
 */
export function getAllProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading projects from localStorage:', error);
    return [];
  }
}

/**
 * Get a single project by ID
 */
export function getProject(id: string): Project | null {
  const projects = getAllProjects();
  return projects.find(p => p.id === id) || null;
}

/**
 * Save a project to localStorage
 */
export function saveProject(project: Project): void {
  if (typeof window === 'undefined') return;

  try {
    const projects = getAllProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    const updatedProject = {
      ...project,
      updatedAt: Date.now(),
    };

    if (index >= 0) {
      projects[index] = updatedProject;
    } else {
      projects.push(updatedProject);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error('Error saving project to localStorage:', error);
  }
}

/**
 * Delete a project
 */
export function deleteProject(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const projects = getAllProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting project from localStorage:', error);
  }
}

/**
 * Create a new project (auto-generates table immediately)
 */
export function createProject(
  title: string,
  layer: string,
  fromChainage: string,
  toChainage: string,
  chainageInterval: number,
  pointsPerChainage: number,
  pointPattern?: string[]
): Project {
  const project: Project = {
    id: `project-${Date.now()}`,
    title,
    layer,
    fromChainage,
    toChainage,
    chainageInterval,
    pointsPerChainage,
    pointPattern: pointPattern && pointPattern.length ? pointPattern : ['3.5 LHS', 'CL', '3.5 RHS'],
    date: new Date().toISOString().split('T')[0],
    rows: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Auto-generate table immediately
  project.rows = generateTableRows(project);

  saveProject(project);
  return project;
}

/**
 * Generate table rows for a project
 * First row is BM row, chainage points start from second row
 */
export function generateTableRows(project: Project): Row[] {
  const points = generateChainagePoints(
    project.fromChainage,
    project.toChainage,
    project.pointsPerChainage,
    project.chainageInterval,
    project.pointPattern
  );
  
  // Create BM row first (row 0)
  const bmRow: Row = {
    id: `row-bm-${Date.now()}`,
    chainage: '', // Will be set when BM name is entered
  };
  
  // Then add chainage points (starting from row 1)
  const chainageRows = points.map((point, index) => ({
    id: `row-${Date.now()}-${index}`,
    chainage: point.displayName,
    chainageType: point.chainageType,
  }));
  
  return [bmRow, ...chainageRows];
}

