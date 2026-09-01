import React from 'react'
import лого_бел from '../../assets/лого_бел.jpg'
import { FaRegBell } from "react-icons/fa";
import  StoryDp from './StoryDp'
import { useSelector } from 'react-redux';
import Post from './Post';
import { BiMessageAltDetail } from "react-icons/bi";
import { useNavigate } from 'react-router-dom';

function Feed() {
    const {postData}=useSelector(state=>state.post)
    const {userData}=useSelector(state=>state.user)

    const {storyList, currentUserStory}=useSelector(state=>state.story)
    const navigate=useNavigate()

    const [scrolled, setScrolled] = React.useState(false)
    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return(
        <div className='w-full bg-black min-h-[100vh] lg:h-[100vh] relative lg:overflow-y-auto'>

            {/* ── Залипающая шапка (мобильный) ── */}
            <div
                className='sticky top-0 z-20 lg:relative transition-[backdrop-filter,background-color,border-radius] duration-300 lg:hidden'
                style={{
                    backgroundColor: scrolled ? 'rgba(0,0,0,0.6)' : 'rgb(0,0,0)',
                    backdropFilter: scrolled ? 'blur(16px)' : 'none',
                    WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
                    borderBottomLeftRadius: scrolled ? '22px' : '0px',
                    borderBottomRightRadius: scrolled ? '22px' : '0px',
                }}
            >
                <div className='w-full h-[72px] grid grid-cols-3 items-center px-[24px]'>
                    <div className='flex items-center'>
                        <FaRegBell
                            className='text-white w-[30px] h-[30px] cursor-pointer'
                            onClick={() => navigate('/notifications')}
                        />
                    </div>
                    <div className='flex justify-center'>
                        <img
                            src={лого_бел}
                            alt='AVTOTIME'
                            data-avtotime-logo="social"
                            className='w-[70px] cursor-pointer transition-transform duration-200 hover:scale-105'
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                window.dispatchEvent(new CustomEvent('avtotime:logo-bridge', {
                                    detail: { to: '/market', originRect: rect },
                                }));
                            }}
                        />
                    </div>
                    <div className='flex justify-end'>
                        <BiMessageAltDetail
                            className='text-white w-[30px] h-[30px] cursor-pointer'
                            onClick={() => navigate('/messages')}
                        />
                    </div>
                </div>
            </div>

            {/* ── Истории (скролятся вместе с контентом) ── */}
            <div className='flex w-full overflow-x-auto gap-[8px] items-center px-[16px] py-[6px] bg-black'>
                <StoryDp compact userName={'Ваша история'} ProfileImage={userData?.profileImage} story={currentUserStory}/>
                {storyList?.map((story, index) => (
                    <StoryDp compact userName={story.author.userName} ProfileImage={story.author.profileImage} story={story} key={index}/>
                ))}
            </div>

            {/* ── Посты (скролятся) ── */}
            <div className='w-full min-h-[100vh] flex flex-col items-center gap-[20px] p-[10px] pt-[20px] bg-white rounded-t-[60px] relative pb-[120px]'>
                {postData?.map((post, index) =>
                    <Post post={post} key={index} />
                )}
            </div>

        </div>
    )
}

export default Feed
