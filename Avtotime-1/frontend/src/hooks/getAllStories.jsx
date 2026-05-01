import React, { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../App'
import { useDispatch, useSelector } from 'react-redux'

import { setStoryList } from '../redux/storySlice' 

function GetAllStories() { 
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)
    const { storyData } = useSelector(state => state.story)

    useEffect(() => {
        const fetchStories = async () => {
           
            if (!userData) return;

            try {
                
                const result = await axios.get(`${serverURL}/api/story/getAll`, { 
                    withCredentials: true 
                })
                dispatch(setStoryList(result.data))
            } catch (error) {
                console.error("Ошибка при получении сторис:", error)
            }
        }

        fetchStories()
    }, [userData, storyData]) 
    return null; 
}

export default GetAllStories