import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type AssistantDensity = 'comfortable' | 'compact'

interface AssistantUIState {
  density: AssistantDensity
  accent: boolean
  reduceMotion: boolean
  allowKnowledgeTools: boolean
  allowWebsiteSourceTools: boolean
  setDensity: (density: AssistantDensity) => void
  setAccent: (accent: boolean) => void
  setReduceMotion: (reduceMotion: boolean) => void
  setAllowKnowledgeTools: (allow: boolean) => void
  setAllowWebsiteSourceTools: (allow: boolean) => void
  reset: () => void
}

const DEFAULT_STATE: Pick<AssistantUIState, 'density' | 'accent' | 'reduceMotion' | 'allowKnowledgeTools' | 'allowWebsiteSourceTools'> = {
  density: 'comfortable',
  accent: true,
  reduceMotion: false,
  allowKnowledgeTools: true,
  allowWebsiteSourceTools: true,
}

export const useAssistantUIStore = create<AssistantUIState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      setDensity: (density) => set({ density }),
      setAccent: (accent) => set({ accent }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setAllowKnowledgeTools: (allowKnowledgeTools) => set({ allowKnowledgeTools }),
      setAllowWebsiteSourceTools: (allowWebsiteSourceTools) => set({ allowWebsiteSourceTools }),
      reset: () => set({ ...DEFAULT_STATE }),
    }),
    {
      name: 'assistant-ui-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
