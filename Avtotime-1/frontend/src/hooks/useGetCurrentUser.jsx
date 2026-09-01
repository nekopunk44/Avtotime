import React, { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../App'
import { useDispatch } from 'react-redux'
import { setFollowing, setUserData } from '../redux/userSlice'
import { setCurrentUserStory } from '../redux/storySlice'

function getCurrentUser() {
    const dispatch = useDispatch()
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/auth/session`, { withCredentials: true })
                const currentUser = result.data

                dispatch(setUserData(currentUser))
                dispatch(setFollowing((currentUser?.following || []).map((u) => (typeof u === 'string' ? u : u?._id)).filter(Boolean)))
                dispatch(setCurrentUserStory(currentUser?.story || null))
            } catch (error) {
                console.log(error)
            }
        }
        fetchUser()
    }, [dispatch])
}

export default getCurrentUser
