import React from 'react'
import logoWhite from '../../assets/лого_бел.jpg'
import { FaRegBell } from "react-icons/fa";
import profile from '../../assets/profile.png'
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../../App';
import { setUserData } from '../../redux/userSlice';
import OtherUser from '../social/OtherUser';
import { useNavigate } from 'react-router-dom';

function LeftHome() {


    const { userData, suggestedUsers } = useSelector(state => state.user)
    const { unreadCount } = useSelector(state => state.notification)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    
    const handleLogOut = async () => {
        try {
            const result = await axios.get(`${serverURL}/api/auth/signout`, { withCredentials: true })
            dispatch(setUserData(null))
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <div className='w-[25%] hidden lg:block min-h-[100vh] bg-[black] border-r-2 border-gray-900'>
            <div className='w-full h-[100px] flex items-center justify-between p-[20px]'>
                <img
                    src={logoWhite}
                    alt='AVTOTIME'
                    data-avtotime-logo="social"
                    className='w-[80px] cursor-pointer transition-transform duration-200 hover:scale-105'
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        window.dispatchEvent(new CustomEvent('avtotime:logo-bridge', {
                            detail: { to: '/market', originRect: rect },
                        }));
                    }}
                />
                <div className='relative'>
                    <FaRegBell
                        className='text-[white] w-[25px] h-[25px] cursor-pointer'
                        onClick={() => navigate('/notifications')}
                    />
                    {unreadCount > 0 ? (
                        <div className='absolute -top-[6px] -right-[6px] min-w-[18px] h-[18px] px-[5px] flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold'>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    ) : null}
                </div>
            </div>
            <div className='flex items-center w-full justify-between gap-[10px] px-[20px] border-b-2 border-b-gray-900 py-[10px]'>

                <div className='flex items-center gap-[10px]'>

                    <div className='w-[70px] h-[70px] border-2 border-black rounded-full cursor-pointer overflow-hidden'>
                        <img src={userData.profileImage || profile} alt="" className='w-full h-full object-cover' />
                    </div>
                    <div>
                        <div className='text-[18px] text-white font-semibold'>{userData.userName}</div>
                        <div className='text-[15px] text-gray-400 font-semibold'>{userData.name}</div>
                    </div>
                </div>
                <div className='text-blue-500 font-semibold cursor-pointer' onClick={handleLogOut}>Выйти</div>
            </div>

            <div className='w-full flex flex-col gap-[20px] p-[20px]'>
                <h1 className='text-[white] text-[19px]'>Рекомендуемые пользователи</h1>
                {suggestedUsers && suggestedUsers.slice(0,10).map((user, index)=>(
                    <OtherUser key={index} user={user} />
                ))}
            </div>

        </div>
    )
}

export default LeftHome
