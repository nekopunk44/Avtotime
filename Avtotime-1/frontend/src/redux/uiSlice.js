import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
    name: 'ui',
    initialState: { modalOpen: false },
    reducers: {
        setModalOpen: (state, action) => { state.modalOpen = action.payload },
    },
})

export const { setModalOpen } = uiSlice.actions
export default uiSlice.reducer
