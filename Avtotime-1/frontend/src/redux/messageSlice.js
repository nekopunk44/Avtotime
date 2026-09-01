import { createSlice } from '@reduxjs/toolkit'

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b)

const messageSlice = createSlice({
    name: "message",
    initialState: {
        selectedUser: null,
        messages: []
    },
    reducers: {
        setSelectedUser: (state, action) => {
            state.selectedUser = action.payload
        },
        setMessages: (state, action) => {
            state.messages = Array.isArray(action.payload) ? action.payload : []
        },
        // Socket 'newMessage' also echoes back messages we sent ourselves, so
        // appending has to be idempotent by _id.
        addMessage: (state, action) => {
            const message = action.payload
            if (!message?._id) return
            if (state.messages.some((item) => sameId(item?._id, message._id))) return
            state.messages.push(message)
        },
        // Socket 'messagesRead' carries { by }: the peer read everything we sent.
        markMessagesReadBy: (state, action) => {
            const readerId = action.payload
            if (!readerId) return
            state.messages = state.messages.map((item) =>
                sameId(item?.receiver, readerId) && !item?.read ? { ...item, read: true } : item
            )
        },
    }
})

export const { setSelectedUser, setMessages, addMessage, markMessagesReadBy } = messageSlice.actions
export default messageSlice.reducer
