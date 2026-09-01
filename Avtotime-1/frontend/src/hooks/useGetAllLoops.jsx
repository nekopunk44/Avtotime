import { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../config/serverUrl'
import { useDispatch, useSelector } from 'react-redux'
import { setLoopData } from '../redux/loopSlice'

function useGetAllLoops() {
    const dispatch = useDispatch()
    const userId = useSelector(state => state.user.userData?._id)

    useEffect(() => {
        if (!userId) {
            dispatch(setLoopData([]))
            return undefined
        }

        let cancelled = false

        const fetchLoops = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/loop/getAll?page=1&limit=20`, { withCredentials: true })
                if (cancelled) return
                dispatch(setLoopData(result.data))
            } catch (error) {
                if (cancelled) return
                if (error.response?.status !== 400) {
                    console.log(error)
                }
            }
        }

        fetchLoops()

        return () => {
            cancelled = true
        }
    }, [dispatch, userId])
}

export default useGetAllLoops
