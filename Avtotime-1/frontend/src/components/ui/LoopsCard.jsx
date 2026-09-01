import React, { useEffect, useRef, useState } from 'react'
import { FiVolume2, FiVolumeX } from "react-icons/fi";
import profile from '../../assets/profile.png'
import FollowButton from '../social/FollowButton';
import { GoHeart } from "react-icons/go";
import { useDispatch, useSelector } from 'react-redux';
import { GoHeartFill } from "react-icons/go";
import { MdOutlineComment } from "react-icons/md";
import axios from 'axios';
import { serverURL } from '../../config/serverUrl';
import { IoSendSharp } from "react-icons/io5";
import { setLoopData } from '../../redux/loopSlice';




function LoopsCard({ loop }) {
    const videoRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(true)
    const [isMute, setIsMute] = useState(true)
    const [progress, setProgress] = useState(0)
    const { userData } = useSelector(state => state.user)
    const { loopData } = useSelector(state => state.loop)
    const [showHeart, setShowHeart] = useState(false)
    const [showComment, setShowComment] = useState(false)
    const [message, setMessage]=useState('')
    const dispatch = useDispatch()
    const commentRef = useRef()
    const comments = Array.isArray(loop?.commentsPreview) ? loop.commentsPreview : (Array.isArray(loop?.comments) ? loop.comments : [])
    const commentsCount = typeof loop?.commentsCount === 'number' ? loop.commentsCount : comments.length

    const handleLikeOnDoubleClick = () => {
        setShowHeart(true)
        setTimeout(() => setShowHeart(false), 6000)
        { !loop.likes?.includes(userData._id) ? handleLike() : null }
    }

    const handleTimeUpdate = () => {
        const video = videoRef.current
        if (video) {
            const percent = (video.currentTime / video.duration) * 100
            setProgress(percent)
        }
    }

    const handleClick = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause()
                setIsPlaying(false)
            } else {
                videoRef.current.play()
                setIsPlaying(true)
            }
        }
    }

    const handleLike = async () => {
        try {
            const result = await axios.get(`${serverURL}/api/loop/like/${loop._id}`, { withCredentials: true })
            const updatedLoop = result.data

            const updatedLoops = loopData.map(p => p._id == loop._id ? updatedLoop : p)
            dispatch(setLoopData(updatedLoops))

        } catch (error) {
            console.log(error)
        }
    }


     const handleComment = async () => {
        try {
            const result = await axios.post(`${serverURL}/api/loop/comment/${loop._id}`,{message}, { withCredentials: true })
            const updatedLoop = result.data

            const updatedLoops = loopData.map(p => p._id == loop._id ? updatedLoop : p)
            dispatch(setLoopData(updatedLoops))
            setMessage('')
        } catch (error) {
            console.log(error)
        }
    }


    

    useEffect(()=>{
        const handleClickOutside=(event)=>{
            if(commentRef.current && !commentRef.current.contains(event.target) ){
                setShowComment(false)
            }
        }

        if(showComment){
            document.addEventListener('mousedown', handleClickOutside)
        }else{
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showComment])

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            const video = videoRef.current;

            if (video) {
                if (entry.isIntersecting) {
                    video.play().then(() => setIsPlaying(true)).catch(error => {
                        console.error("Автоплей заблокирован:", error);
                    });
                } else {
                    video.pause();
                    setIsPlaying(false)
                }
            }
        }, { threshold: 0.6 });

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => {
            if (videoRef.current) {
                observer.unobserve(videoRef.current);
            }
        };
    }, [loop?.media]);

    return (
        <div className='w-full lg:w-[450px] h-[100vh] flex items-center justify-center border-l border-r border-gray-800 relative bg-black overflow-hidden'>
    

            {showHeart && (
                <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none'>
                    <div className='heart-animation'>
                        <GoHeartFill className='w-[100px] h-[100px] text-white/90 drop-shadow-2xl' />
                    </div>
                </div>
            )}

            <div ref={commentRef} className={`absolute z-[200] bottom-0 w-full h-[500px] transition-transform duration-500 ease-in-out
    p-[10px] rounded-t-xl bg-[#0e1718] left-0 shadow-2xl shadow-black ${showComment ? 'translate-y-0' : 'translate-y-[100%]'}`}>

    <h1 className='text-white text-[20px] text-center font-semibold mb-4'>Комментарии</h1>

   <div className='w-full h-[330px] overflow-y-auto flex flex-col gap-[20px] px-4'> 

    
    {commentsCount === 0 && (
        <div className='text-center text-white text-[18px] font-semibold mt-[50px]'>
            Еще нет комментариев
        </div>
    )}

    {comments.map((com, index) => (
        <div key={index} className='w-full flex flex-col gap-[8px] border-b border-gray-800 pb-[12px]'>
            <div className='flex items-center gap-3'>
                <div className='flex-shrink-0 w-[35px] h-[35px] border border-gray-700 rounded-full overflow-hidden'>
                    <img src={com.author?.profileImage || profile} alt="" className='w-full h-full object-cover' />
                </div>
                <div className='font-semibold truncate text-[16px] text-white '>
                    {com.author?.userName}
                </div>
            </div>

 
            <div className='text-white pl-[45px] pr-2 text-[14px] leading-relaxed break-words'>
                {com.message}
            </div>
        </div>
    ))}
</div>

    <div className='w-full flex items-center gap-4 px-6 py-12px fixed bottom-8 left-0 bg-[#0e1718]'>
        
        {/* Аватар */}
        <div className='w-10 h-10 md:w-12 md:h-12 flex-shrink-0 border border-gray-300 rounded-full overflow-hidden'>
            <img 
                src={loop.author?.profileImage || profile}
                alt="avatar" 
                className='w-20px h-20px object-center' 
            />
        </div>

        {/* Инпут и кнопка в одном контейнере */}
        <div className='flex-1 flex items-center relative'>
            <input 
                type="text" 
                className='w-full py-2 pr-12 border-b border-gray-300 outline-none text-sm text-white bg-transparent placeholder:text-gray-400'
                placeholder='Напишите комментарий...' 
                onChange={(e) => setMessage(e.target.value)} 
                value={message}
            />

    {message && <button 
                className='absolute right-2 cursor-pointer text-blue-500 hover:scale-110 transition-transform' 
                onClick={handleComment}
            >
                <IoSendSharp className='w-5 h-5' />
            </button>}
            
        </div>
    </div>
</div>


            <video
                ref={videoRef}
                loop
                src={loop?.media}
                muted={isMute}
                playsInline
                
                className='max-w-[70%] lg:max-w-[95%] max-h-[60%] lg:max-h-[85%] object-contain cursor-pointer rounded-xl'
                onClick={handleClick}
                onTimeUpdate={handleTimeUpdate}
                onDoubleClick={handleLikeOnDoubleClick}
            />

            {/* Кнопка звука */}
            <div className='absolute top-[20px] right-[20px] z-[100] bg-black/40 p-2 rounded-full cursor-pointer' onClick={() => setIsMute(prev => !prev)}>
                {!isMute ? <FiVolume2 className='w-[22px] h-[22px] text-white' /> :
                    <FiVolumeX className='w-[22px] h-[22px] text-white' />}
            </div>

            {/* Инфо автора */}
            <div className='absolute bottom-[30px] left-0 right-0 px-[15px] z-[50] flex items-end justify-between text-white gap-4'>
                <div className='flex items-start gap-3'>
                    <div className='w-[40px] h-[40px] md:w-[50px] md:h-[50px] border border-white rounded-full overflow-hidden shadow-lg shrink-0'
                        
                        >
                        <img
                            src={loop.author?.profileImage || profile}
                            alt='avatar'
                            className='w-full h-full object-cover'
                            onClick={() => (`/profile/${loop.author?._id}`)}
                        />
                    </div>

                    <div className='flex flex-col gap-1'>
                        <span className='font-bold text-[16px] md:text-[20px] drop-shadow-md text-white whitespace-nowrap'>
                            {loop.author?.userName}
                        </span>

                        <div className='text-white text-[14px] md:text-[16px] leading-tight drop-shadow-sm max-w-[200px] md:max-w-[400px] line-clamp-2'>
                            {loop.caption}
                        </div>
                        <div className='absolute right-0 flex flex-col gap-[20px] text-white bottom-[280px] justify center px-[10px]'>
                            <div className='flex flex-col items-center cursor-pointer'>
                                <div onClick={handleLike}>
                                    {!loop.likes.includes(userData._id) && <GoHeart className='w-[25px] cursor-pointer h-[25px]' />}
                                    {loop.likes.includes(userData._id) && <GoHeartFill className='w-[25px] cursor-pointer h-[25px] text-red-600' />}
                                </div>
                                <div>{loop.likes.length}</div>
                            </div>
                            <div className='flex flex-col items-center cursor-pointer' onClick={() => setShowComment(true)}>
                                <div><MdOutlineComment className='w-[25px] cursor-pointer h-[25px]' /></div>
                                <div>{commentsCount}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='pb-1'>
                    <FollowButton
                        targetUserId={loop.author?._id}
                        tailwind={'px-[16px] py-[6px] md:px-[20px] md:py-[8px] text-white border border-white text-[13px] md:text-[15px] font-semibold rounded-full hover:bg-white/20 transition-all whitespace-nowrap'}
                    />

                </div>
            </div>

            {/* Прогресс-бар */}
            <div className='absolute bottom-0 w-full h-[3px] bg-white/20'>
                <div
                    className='h-full bg-red-600 transition-all duration-100 ease-linear'
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    )
}

export default LoopsCard
