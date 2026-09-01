import { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../config/serverUrl'
import { useDispatch, useSelector } from 'react-redux'
import { setPostData } from '../redux/postSlice'

function useGetAllPost() {
    const dispatch = useDispatch()
    // Depend on the id, not the userData object: setUserData is dispatched from
    // many places (save/like/follow) and would otherwise refetch every time.
    const userId = useSelector(state => state.user.userData?._id)

    useEffect(() => {
        if (!userId) {
            dispatch(setPostData([]))
            return undefined
        }

        let cancelled = false

        const fetchPost = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/post/getAll?page=1&limit=20`, { withCredentials: true })
                if (cancelled) return
                dispatch(setPostData(result.data))
            } catch (error) {
                if (cancelled) return
                if (error.response?.status !== 400) {
                    console.log(error)
                }
            }
        }

        fetchPost()

        return () => {
            cancelled = true
        }
    }, [dispatch, userId])
}

export default useGetAllPost
