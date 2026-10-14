let workflowEditorModulePromise: Promise<unknown> | null = null;
let workflowEditorAssetsPromise: Promise<unknown> | null = null;
let workflowEditorExperiencePromise: Promise<unknown> | null = null;

export const loadWorkflowEditor = () => {
  if (!workflowEditorModulePromise) {
    workflowEditorModulePromise = import('../components/WorkflowEditor');
  }
  return workflowEditorModulePromise;
};

export const preloadWorkflowEditorAssets = () => {
  if (!workflowEditorAssetsPromise) {
    workflowEditorAssetsPromise = import('@monaco-editor/react')
      .then((mod) => mod.loader.init())
      .catch(() => undefined);
  }
  return workflowEditorAssetsPromise;
};

export const preloadWorkflowEditorExperience = () => {
  if (!workflowEditorExperiencePromise) {
    workflowEditorExperiencePromise = Promise.allSettled([
      loadWorkflowEditor(),
      preloadWorkflowEditorAssets(),
    ]);
  }
  return workflowEditorExperiencePromise;
};
