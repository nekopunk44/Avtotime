import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { serverURL } from '../../App'
import axios from 'axios'
import { toggleFollow } from '../../redux/userSlice'

function FollowButton({targetUserId, tailwind, onFollowChange}) {
    const {following}=useSelector(state=>state.user)
    const isFollowing=following.includes(targetUserId)
    const dispatch=useDispatch()
    const handleFollow = async()=>{
        try{
            await axios.post(`${serverURL}/api/user/follow/${targetUserId}`, null, {withCredentials:true})
            if(onFollowChange){
                onFollowChange()
            }
            dispatch(toggleFollow(targetUserId))
        } catch (error) {
            console.log(error)
        }
    }
    return(
        <button
            className={tailwind}
            style={isFollowing ? { backgroundColor: '#6b7280', color: '#fff', borderColor: '#6b7280' } : undefined}
            onClick={handleFollow}
        >
            {isFollowing ? 'Подписки' : 'Подписаться'}
        </button>
    )
}

export default FollowButton
