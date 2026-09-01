import { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../config/serverUrl'
import { useDispatch, useSelector } from 'react-redux'
import { setSuggestedUsers } from '../redux/userSlice'

function useGetSuggestedUsers() {
    const dispatch = useDispatch()
    const userId = useSelector(state => state.user.userData?._id)

    useEffect(() => {
        if (!userId) {
            dispatch(setSuggestedUsers([]))
            return undefined
        }

        let cancelled = false

        const fetchUser = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/user/suggested`, { withCredentials: true })
                if (cancelled) return
                dispatch(setSuggestedUsers(result.data))
            } catch (error) {
                if (cancelled) return
                if (error.response?.status !== 400) {
                    console.log(error)
                }
            }
        }

        fetchUser()

        return () => {
            cancelled = true
        }
    }, [dispatch, userId])
}

export default useGetSuggestedUsers
