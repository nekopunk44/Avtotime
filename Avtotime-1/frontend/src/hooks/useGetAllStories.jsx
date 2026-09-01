import { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../config/serverUrl'
import { useDispatch, useSelector } from 'react-redux'

import { setStoryList } from '../redux/storySlice'

function useGetAllStories() {
    const dispatch = useDispatch()
    const userId = useSelector(state => state.user.userData?._id)

    useEffect(() => {
        if (!userId) {
            dispatch(setStoryList([]))
            return undefined
        }

        let cancelled = false

        const fetchStories = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/story/getAll`, {
                    withCredentials: true
                })
                if (cancelled) return
                dispatch(setStoryList(result.data))
            } catch (error) {
                if (cancelled) return
                console.error("Ошибка при получении сторис:", error)
            }
        }

        fetchStories()

        return () => {
            cancelled = true
        }
    }, [dispatch, userId])
}

export default useGetAllStories
