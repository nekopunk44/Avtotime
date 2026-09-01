import React, { useEffect } from 'react'
import axios from 'axios'
import { serverURL } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setLoopData } from '../redux/loopSlice'

function getAllLoops() {
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user) 


    useEffect(() => {
        if (!userData) {
            dispatch(setLoopData([]))
            return
        }

        const fetchLoops = async () => {
            try {
                const result = await axios.get(`${serverURL}/api/loop/getAll?page=1&limit=20`, { withCredentials: true })
                dispatch(setLoopData(result.data))
            } catch (error) {
                if (error.response?.status !== 400) {
                    console.log(error)
                }
            }
        }
        
        fetchLoops()
   
    }, [dispatch, userData]) 
}

export default getAllLoops
