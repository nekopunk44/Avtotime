import { createSlice } from '@reduxjs/toolkit'

// 'idle'         — session request has not started yet
// 'loading'      — session request is in flight, routes must not redirect yet
// 'authenticated'/'anonymous' — session resolved
export const AUTH_STATUS = {
    IDLE: 'idle',
    LOADING: 'loading',
    AUTHENTICATED: 'authenticated',
    ANONYMOUS: 'anonymous',
}

const userSlice = createSlice({
    name: "user",
    initialState: {
        userData: null,
        suggestedUsers: null,
        profileData: null,
        following: [],
        authStatus: AUTH_STATUS.IDLE,
    },
    reducers: {
        setUserData: (state, action) => {
            state.userData = action.payload
            // Every setUserData is a definitive answer about the session, so the
            // status must follow it (sign in / sign out / profile refresh).
            state.authStatus = action.payload ? AUTH_STATUS.AUTHENTICATED : AUTH_STATUS.ANONYMOUS
        },
        setAuthStatus: (state, action) => {
            state.authStatus = action.payload
        },
        setSuggestedUsers: (state, action) => {
            state.suggestedUsers = action.payload
        },
        setProfileData: (state, action) => {
            state.profileData = action.payload
        },
        setFollowing: (state, action) => {
            state.following = action.payload
        },
        toggleFollow: (state, action) => {
            const targetUserId = action.payload
            if (state.following.includes(targetUserId)) {
                state.following = state.following.filter(id => id !== targetUserId)
            } else {
                state.following.push(targetUserId)
            }
        }
    }
})

export const {
    setUserData,
    setAuthStatus,
    setSuggestedUsers,
    setProfileData,
    toggleFollow,
    setFollowing,
} = userSlice.actions
export default userSlice.reducer
