import React, { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setPostData } from '../redux/postSlice'

function getAllPost() {
    const dispatch = useDispatch()
    

    const { userData } = useSelector(state => state.user) 

    useEffect(() => {
        if (!userData) {
            dispatch(setPostData([]))
            return
        }

        const fetchPost = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/post/getAll?page=1&limit=20`, { withCredentials: true })
                dispatch(setPostData(result.data))
            } catch (error) {
                if (error.response?.status !== 400) {
                    console.log(error)
                }
            }
        }
        
        fetchPost()
   
    }, [dispatch, userData]) 
}

export default getAllPost
