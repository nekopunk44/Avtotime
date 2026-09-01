import { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../config/serverUrl'
import { useDispatch } from 'react-redux'
import { AUTH_STATUS, setAuthStatus, setFollowing, setUserData } from '../redux/userSlice'
import { setCurrentUserStory } from '../redux/storySlice'

function useGetCurrentUser() {
    const dispatch = useDispatch()

    useEffect(() => {
        let cancelled = false

        const fetchUser = async () => {
            dispatch(setAuthStatus(AUTH_STATUS.LOADING))
            try {
                const result = await axios.get(`${serverURL}/api/auth/session`, { withCredentials: true })
                if (cancelled) return
                const currentUser = result.data

                dispatch(setUserData(currentUser))
                dispatch(setFollowing((currentUser?.following || []).map((u) => (typeof u === 'string' ? u : u?._id)).filter(Boolean)))
                dispatch(setCurrentUserStory(currentUser?.story || null))
            } catch {
                if (cancelled) return
                // No valid session cookie — this is the normal guest case, not an error.
                dispatch(setUserData(null))
                dispatch(setFollowing([]))
                dispatch(setCurrentUserStory(null))
            }
        }

        fetchUser()

        return () => {
            cancelled = true
        }
    }, [dispatch])
}

export default useGetCurrentUser
