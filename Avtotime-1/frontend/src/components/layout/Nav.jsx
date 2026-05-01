import React, { useEffect, useMemo, useState } from 'react'
import { GoHomeFill } from "react-icons/go";
import { FiSearch } from "react-icons/fi";
import { RxVideo } from "react-icons/rx";
import { FiPlusSquare } from "react-icons/fi";
import profile from '../../assets/profile.png'
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';



function Nav() {
    const navigate = useNavigate()
    const { userData } = useSelector(state => state.user)
    const { modalOpen } = useSelector(state => state.ui)
    const prefersReducedMotion = useMemo(() => (
        typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ), [])

    const [isAnimatedIn, setIsAnimatedIn] = useState(prefersReducedMotion)

    useEffect(() => {
        if (prefersReducedMotion) return
        const id = requestAnimationFrame(() => setIsAnimatedIn(true))
        return () => cancelAnimationFrame(id)
    }, [prefersReducedMotion])

    const getItemStyle = useMemo(() => {
        return (index) => ({
            opacity: isAnimatedIn ? 1 : 0,
            transform: isAnimatedIn ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.85)',
            transitionProperty: 'opacity, transform',
            transitionDuration: '650ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            transitionDelay: isAnimatedIn ? `${320 + index * 120}ms` : '0ms',
            willChange: 'transform, opacity',
        })
    }, [isAnimatedIn])

    if (modalOpen) return null

    return (
        /* Контейнер навигации */
        <div
            className='h-[70px] bg-black flex justify-around items-center fixed bottom-[20px] left-1/2 -translate-x-1/2 rounded-full shadow-2xl shadow-black z-[100] border border-gray-800 overflow-hidden'
            style={{
                width: isAnimatedIn ? '90%' : '74px',
                maxWidth: '550px',
                transitionProperty: 'width',
                transitionDuration: '2200ms',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'width',
            }}
        >
            
            <div style={getItemStyle(0)} className='cursor-pointer' onClick={() => navigate('/')}>
                <GoHomeFill className='text-white w-[25px] h-[25px]'/>
            </div>
            
            <div style={getItemStyle(1)} className='cursor-pointer' onClick={() => navigate('/search/posts')}>
                <FiSearch className='text-white w-[25px] h-[25px]'/>
            </div>
            
            <div style={getItemStyle(2)} className='cursor-pointer' onClick={()=>navigate('/upload')}>
                <FiPlusSquare className='text-white w-[25px] h-[25px]'/>
            </div>
            
            <div style={getItemStyle(3)} className='cursor-pointer' onClick={() => navigate('/loops')}>
                <RxVideo className='text-white w-[28px] h-[28px]'/>
            </div>
            
            {/* Кнопка профиля */}
            <div 
                style={getItemStyle(4)}
                className='w-[40px] h-[40px] border-2 border-gray-700 rounded-full cursor-pointer overflow-hidden' 
                onClick={() => navigate(`/profile/${userData?.userName}`)}
            >
                <img src={userData.profileImage || profile} alt="profile" className='w-full h-full object-cover' />
            </div>
        </div>
    )
}

export default Nav
