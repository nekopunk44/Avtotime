import React, { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setSuggestedUsers } from '../redux/userSlice'

function getSuggestedUsers() {
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)
    useEffect(() => {
        if (!userData) {
            dispatch(setSuggestedUsers([]))
            return
        }

        const fetchUser = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/user/suggested`, { withCredentials: true })
                dispatch(setSuggestedUsers(result.data))
            } catch (error) {
                if (error.response?.status !== 400) {
                    console.log(error)
                }
            }
        }
        fetchUser()
    }, [dispatch, userData])
}

export default getSuggestedUsers
