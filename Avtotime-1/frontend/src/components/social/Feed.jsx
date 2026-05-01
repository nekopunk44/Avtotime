import React from 'react'
import profile from '../../assets/profile.png'
import лого_бел from '../../assets/лого_бел.jpg'
import { FaRegHeart } from "react-icons/fa";
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

    return(
        <div className='w-full bg-black min-h-[100vh] lg:h-[100vh] relative lg:overflow-y-auto'>
                <div className='w-full h-[100px] flex items-center justify-between p-[20px] lg:hidden'>
                                <img
                                    src={лого_бел}
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
                                <div className='flex items-center gap-[10px]'>
                                    <FaRegHeart className='text-[white] w-[25px] h-[25px]' />
                                    <BiMessageAltDetail className='text-[white] w-[25px] h-[25px]'
                                    onClick={()=>navigate('/messages')} />
                                </div>
                            </div>
                            <div className='flex w-full overflow-auto gap-[10px] items-center p-[20px]'>

                                <StoryDp userName={'Ваша история'} ProfileImage={userData?.profileImage} story={currentUserStory}/>

                            {storyList?.map((story, index)=>(
                                <StoryDp userName={story.author.userName} ProfileImage={story.author.profileImage} story={story} key={index}/>
                            ))}

                            </div>

        <div className='w-full min-h-[100vh] flex flex-col items-center gap-[20px] p-[10px] pt-[20px] bg-white rounded-t-[60px] relative pb-[120px]'>
    
        {postData?.map((post, index)=>
            <Post post={post} key={index} />
        )}

        </div>

            </div>
    )
}

export default Feed
