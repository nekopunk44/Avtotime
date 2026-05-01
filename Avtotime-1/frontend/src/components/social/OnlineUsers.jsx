import React from 'react'
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import profile from '../../assets/profile.png'
import { setSelectedUser } from '../../redux/messageSlice';

function OnlineUsers({user}) {
  const dispatch=useDispatch()
  const navigate=useNavigate()
  return (
    <div className='w-[60px] h-[60px] flex gap-[20px] justify-start items-center relative'>
      <div className='w-[40px] h-[40px] border-2 border-black rounded-full
       cursor-pointer overflow-hidden' onClick={()=>{
        dispatch(setSelectedUser(user))
        navigate(`/messagesArea`)
       }}>
            <img src={user.profileImage || profile} alt='' className='w-full object-cover'/>
                              </div>
                              <div className='w-[10px] h-[10px] bg-[#0080ff]
                              rounded-full absolute top-2 right-0'>

                              </div>
    </div>
  )
}

export default OnlineUsers
