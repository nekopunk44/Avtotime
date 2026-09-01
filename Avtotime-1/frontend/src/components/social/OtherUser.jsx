import React from 'react'
import { useDispatch } from 'react-redux'
import profile from '../../assets/profile.png'
import { useLocation, useNavigate } from 'react-router-dom'
import FollowButton from './FollowButton'
import { IoChatbubbleOutline } from 'react-icons/io5'
import { setMessages, setSelectedUser } from '../../redux/messageSlice'

function OtherUser({user}) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()

    const handleOpenProfile = () => navigate(`/profile/${user.userName}`)
    const handleMessage = () => {
        dispatch(setSelectedUser(user))
        dispatch(setMessages([]))

        const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 1024px)').matches
        if (location.pathname === '/' && isDesktop) return
        navigate('/messages')
    }

    return (
        <div className='w-full flex flex-col gap-[8px] border-b-2 border-gray-800 pb-[12px]'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-[10px] cursor-pointer' onClick={handleOpenProfile}>
                    <div className='w-[50px] h-[50px] border-2 border-black rounded-full overflow-hidden flex-shrink-0'>
                        <img src={user.profileImage || profile} alt='' className='w-full h-full object-cover' />
                    </div>
                    <div>
                        <div className='text-[18px] text-white font-semibold truncate hover:underline'>
                            {user.userName}
                        </div>
                        <div className='text-[15px] text-gray-400 font-semibold truncate'>
                            {user.name}
                        </div>
                    </div>
                </div>

                <div className='flex items-center gap-[8px]'>
                    <button
                        onClick={handleMessage}
                        className='flex items-center justify-center w-[40px] h-[40px] rounded-full border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors'
                        title='Написать сообщение'
                    >
                        <IoChatbubbleOutline className='w-[18px] h-[18px]' />
                    </button>
                    <FollowButton
                        tailwind={'px-[10px] w-[110px] py-[5px] h-[40px] bg-[white] rounded-2xl font-semibold text-[14px]'}
                        targetUserId={user?._id}
                    />
                </div>
            </div>
        </div>
    )
}

export default OtherUser
