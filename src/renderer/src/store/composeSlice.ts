import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import undoable, { excludeAction } from 'redux-undo'
import { createDefaultSequence, type Sequence } from '../compose/types'
import type { RootState } from './index'

interface ComposeState {
  sequence: Sequence
  dirty: boolean
  sequenceId: string | null
}

const initialState: ComposeState = {
  sequence: createDefaultSequence(),
  dirty: false,
  sequenceId: null,
}

const composeSlice = createSlice({
  name: 'compose',
  initialState,
  reducers: {
    setSequence(state, action: PayloadAction<Sequence>) {
      state.sequence = action.payload
      state.dirty = true
    },
    loadSequence(state, action: PayloadAction<Sequence>) {
      state.sequence = action.payload
      state.dirty = false
    },
    newSequence(state) {
      state.sequence = createDefaultSequence()
      state.dirty = false
      state.sequenceId = null
    },
    markClean(state) {
      state.dirty = false
    },
    setSequenceId(state, action: PayloadAction<string | null>) {
      state.sequenceId = action.payload
    },
  },
})

export const { setSequence, loadSequence, newSequence, markClean, setSequenceId } = composeSlice.actions

let lastEditTime = 0
let currentGroup = 0
const EDIT_GROUP_TIMEOUT = 500

export default undoable(composeSlice.reducer, {
  limit: 50,
  filter: excludeAction([
    composeSlice.actions.loadSequence.type,
    composeSlice.actions.newSequence.type,
    composeSlice.actions.markClean.type,
    composeSlice.actions.setSequenceId.type,
  ]),
  groupBy: (action) => {
    if (action.type !== composeSlice.actions.setSequence.type) return null
    const now = Date.now()
    if (now - lastEditTime > EDIT_GROUP_TIMEOUT) currentGroup++
    lastEditTime = now
    return currentGroup
  },
})

export const selectSequence = (state: RootState) => state.compose.present.sequence
export const selectComposeDirty = (state: RootState) => state.compose.present.dirty
export const selectSequenceId = (state: RootState) => state.compose.present.sequenceId
export const selectCanUndo = (state: RootState) => state.compose.past.length > 0
export const selectCanRedo = (state: RootState) => state.compose.future.length > 0
