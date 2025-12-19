'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getAllProjects, deleteProject, createProject } from '@/lib/storage';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(() => getAllProjects());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleCreateProject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    let title = formData.get('title') as string;
    const layer = formData.get('layer') as string;
    const fromChainage = formData.get('fromChainage') as string;
    const toChainage = formData.get('toChainage') as string;
    const chainageInterval = parseInt(formData.get('chainageInterval') as string) || 20;
    const pointsPerChainage = parseInt(formData.get('pointsPerChainage') as string) || 3;

    if (!layer || !fromChainage || !toChainage) return;

    // Generate default title if not provided
    if (!title || title.trim() === '') {
      title = `LEVEL CHECK FROM ${fromChainage} TO ${toChainage} FOR ${layer.toUpperCase()}`;
    }

    const project = createProject(title, layer, fromChainage, toChainage, chainageInterval, pointsPerChainage);
    setProjects(getAllProjects());
    setShowCreateModal(false);
    router.push(`/project/${project.id}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this project? This cannot be undone.')) {
      deleteProject(id);
      setProjects(getAllProjects());
      setIsDeleting(null);
    }
  };

  const handleLongPress = (id: string) => {
    setIsDeleting(id);
    // Show delete option after long press
    setTimeout(() => setIsDeleting(null), 3000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-2xl font-semibold text-gray-900">AutoBook</h1>
      </header>

      {/* Projects List */}
      <main className="px-4 py-6">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer relative"
                onClick={() => {
                  if (isDeleting === project.id) {
                    handleDelete(project.id);
                  } else {
                    router.push(`/project/${project.id}`);
                  }
                }}
                onTouchStart={() => {
                  const timer = setTimeout(() => handleLongPress(project.id), 500);
                  const cleanup = () => clearTimeout(timer);
                  document.addEventListener('touchend', cleanup, { once: true });
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900 mb-1">{project.title}</h2>
                    <p className="text-sm text-gray-600 mb-1">{project.layer}</p>
                    <p className="text-xs text-gray-500">
                      {project.fromChainage} - {project.toChainage}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(project.date).toLocaleDateString()}
                    </p>
                  </div>
                  {isDeleting === project.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                      className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Button */}
        {projects.length > 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Create Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Title (optional - auto-generated if empty)
                </label>
                <Input
                  type="text"
                  name="title"
                  placeholder="e.g. LEVEL CHECK FROM 2+460 TO 2+560 FOR SUBGRADE TWO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Layer
                </label>
                <Input
                  type="text"
                  name="layer"
                  required
                  placeholder="e.g. Bottom Bed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Chainage
                  </label>
                  <Input
                    type="text"
                    name="fromChainage"
                    required
                    placeholder="0+000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Chainage
                  </label>
                  <Input
                    type="text"
                    name="toChainage"
                    required
                    placeholder="0+200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chainage Interval
                  </label>
                  <Input
                    type="number"
                    name="chainageInterval"
                    defaultValue={20}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points per Chainage
                  </label>
                  <Input
                    type="number"
                    name="pointsPerChainage"
                    defaultValue={3}
                    min={1}
                    max={5}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
