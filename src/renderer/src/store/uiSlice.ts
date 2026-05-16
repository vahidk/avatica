import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface Project {
  id: string
  name: string
  created_at: number
  updated_at: number
}

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'avatica:theme'

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  return saved === 'light' ? 'light' : 'dark'
}

interface UIState {
  theme: Theme
  currentProject: Project | null
  currentPath: string
  viewMode: 'grid' | 'list'
  appMode: 'create' | 'compose' | 'app-builder' | 'asset-types' | null
  showAssets: boolean
  showLog: boolean
  showChat: boolean
  searchQuery: string
  fileRefreshCounter: number
  schemaIcons: Record<string, string>
}

const initialState: UIState = {
  theme: loadTheme(),
  currentProject: null,
  currentPath: '',
  viewMode: 'grid',
  appMode: null,
  showAssets: true,
  showLog: false,
  showChat: true,
  searchQuery: '',
  fileRefreshCounter: 0,
  schemaIcons: {},
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrentProject(state, action: PayloadAction<Project | null>) {
      state.currentProject = action.payload
      state.currentPath = ''
      state.searchQuery = ''
    },
    setCurrentPath(state, action: PayloadAction<string>) {
      state.currentPath = action.payload
    },
    setViewMode(state, action: PayloadAction<'grid' | 'list'>) {
      state.viewMode = action.payload
    },
    setAppMode(state, action: PayloadAction<'create' | 'compose' | 'app-builder' | 'asset-types' | null>) {
      state.appMode = action.payload
    },
    toggleAssets(state) {
      state.showAssets = !state.showAssets
    },
    toggleLog(state) {
      state.showLog = !state.showLog
    },
    toggleChat(state) {
      state.showChat = !state.showChat
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_STORAGE_KEY, state.theme)
    },
    bumpFileRefresh(state) {
      state.fileRefreshCounter += 1
    },
    setSchemaIcons(state, action: PayloadAction<Record<string, string>>) {
      state.schemaIcons = action.payload
    }
  }
})

export const {
  setCurrentProject, setCurrentPath, setViewMode,
  setAppMode, toggleAssets, toggleLog, toggleChat, setSearchQuery, toggleTheme, bumpFileRefresh, setSchemaIcons
} = uiSlice.actions

export default uiSlice.reducer
