import React, { useEffect, useState, } from 'react'
import profile from '../../assets/profile.png'
import { useSelector } from 'react-redux'
import { MdOutlineKeyboardBackspace } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import VideoPlayer from '../media/VideoPlayer';
import { FaEye } from "react-icons/fa";

function StoryCard({storyData}) {
   const {userData}=useSelector(state=>state.user)
   const [showViewers, setShowViewers]=useState(false)
    const navigate = useNavigate({})
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    navigate('/');
                    return 100;
                }
                return prev + 1;
            });
        }, 150);

        return () => clearInterval(interval);
    }, [navigate]);

    // Защита от отсутствия данных
    if (!storyData) return null;

    return (
        <div className='w-full max-w-[500px] h-[100vh] border-x-2 border-gray-800 pt-[10px] relative flex flex-col justify-center px-4 bg-black'>


                           {/* Полоска прогресса */}
            <div className='absolute top-[10px] left-0 w-full h-[3px] bg-gray-900 z-20'>
                <div 
                    className='h-full bg-white transition-all duration-200 ease-linear' 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
           

            {/* Шапка с аватаром */}
            <div className='flex items-center gap-[10px] absolute top-[25px] left-4 z-10'>
                <MdOutlineKeyboardBackspace 
                    className='text-white cursor-pointer w-[25px] h-[25px]'
                    onClick={() => navigate(`/`)} 
                />
                
                <div className='w-[40px] h-[40px] lg:w-[55px] lg:h-[55px] border-2 border-gray-600 rounded-full cursor-pointer overflow-hidden flex-shrink-0'>
                    <img 
                        src={storyData?.author?.profileImage || profile} 
                        alt='profile' 
                        className='w-full h-full object-center' 
                    />
                </div>

                <div className='font-semibold truncate text-white text-sm lg:text-lg'>
                    {storyData?.author?.userName}
                </div>
            </div>


                     {!showViewers && <> {/* Контент сторис */}
            <div className='w-full h-[90vh] flex flex-col items-center justify-center'>
                {storyData.mediaType === 'image' && 
                    <div className='w-full h-auto flex items-center justify-center'>
                        <img 
                            src={storyData.media} 
                            alt='' 
                            className=' rounded-xl max-w-full object-contain' 
                        />
                    </div>
                }


  

                {storyData.mediaType === 'video' && 
                    <div className='h-[80%] flex flex-col items-center justify-center'>
                       
                        <VideoPlayer media={storyData.media} />
                    </div>
                }
            </div>


{storyData?.author?.userName==userData?.userName && 
    <div className='absolute w-full flex items-center gap-[20px] cursor-pointer text-white h-[70px] bottom-0 p-2 left-0' onClick={()=>setShowViewers(true)}>
    <div className='test-white flex items-center gap-[5px] ml-[15px]'><FaEye />{storyData.viewers.length}</div>
    {/* <div>Просмотры</div> */}


    <div className='flex relative w-[70px] h-[40px]'>
                                {storyData?.viewers?.slice(0, 3).map((viewer, index) => (
                                    <div
                                        className={`w-[35px] h-[35px] md:w-[40px] md:h-[40px] border-2 border-black rounded-full overflow-hidden absolute`}
                                        style={{ left: `${index * 14}px`, zIndex: (index + 1) * 10 }}>
                                        <img src={viewer?.profileImage || profile} className='w-full h-full object-center' alt='' />
                                    </div>
                                ))}
                            </div>


    </div>}</>}

           {showViewers && <>
            <div className='w-full h-[70%] flex flex-col items-center justify-center mt-[100px] cursor-pointer py-[30px] overflow-hidden' onClick={()=>setShowViewers(false)}>
                {storyData.mediaType === 'image' && 
                    <div className='w-full h-full flex items-center justify-center'>
                        <img 
                            src={storyData.media} 
                            alt='' 
                            className='max-h-[80vh] rounded-xl max-w-full object-center' 
                        />
                    </div>
                }


  

                {storyData.mediaType === 'video' && 
                    <div className='w-full h-full flex flex-col items-center justify-center'>
                        
                        <VideoPlayer media={storyData.media} />
                    </div>
                }
            </div>
            <div className='w-full h-[70%] border-t-2 border-t-gray-800 p-[20px]'>
                <div className='text-white flex items-center gap-[10px]'>
                    <FaEye /><span>{storyData?.viewers?.length}</span><span>Просмотров</span></div>

                <div className='w-full max-w-full flex flex-col gap-[10px] overflow-auto pt-[20px]'>
                {storyData?.viewers.map((viewer, index)=>(
                    <div className='w-full flex items-center gap-[20px]'>
                        <div className='w-[40px] h-[40px] lg:w-[55px] lg:h-[55px] border-2 border-gray-600 rounded-full cursor-pointer overflow-hidden flex-shrink-0'>
                    <img 
                        src={viewer?.profileImage || profile} 
                        alt='profile' 
                        className='w-full h-full object-center' 
                    />
                </div>

                <div className='font-semibold truncate text-white text-sm lg:text-lg'>
                    {viewer?.userName}
                </div>
                    </div>
                ))}
                </div>

            </div>
            </>}




        </div>
    )
}

export default StoryCard