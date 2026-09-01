import React, { useEffect, useState } from 'react'
import profile from '../../assets/profile.png'
import { FiPlusCircle } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../../config/serverUrl';


function StoryDp({ProfileImage, userName, story, compact = false}) {

const navigate = useNavigate()
const {userData}=useSelector(state=>state.user)
const {storyData, storyList }=useSelector(state=>state.story)
const [viewed, setViewed] = useState(false)


useEffect(()=>{
    if(story?.viewers?.some((viewer)=>
    viewer?._id?.toString()===userData._id.toString() || viewer?.toString()==userData._id.toString()
)){
    setViewed(true)
} else{
    setViewed(false)
}

},[story,userData, storyData, storyList ])


const hadnleViewers=async()=>{
    try {
        await axios.get(`${serverURL}/api/story/view/${story._id}`, {withCredentials:true})

    } catch (error) {
        console.log(error)
    }
}


const handleClick=()=>{
    if(!story && userName=='Ваша история'){
        navigate('/upload')
    }else if(story && userName=='Ваша история'){
        hadnleViewers()
        navigate(`/story/${userData.userName}`)
        
    }else {
        hadnleViewers()
        navigate(`/story/${userName}`)
    }
}



    const outer = compact ? 'w-[58px] h-[58px]' : 'w-[80px] h-[80px]'
    const inner = compact ? 'w-[50px] h-[50px]' : 'w-[70px] h-[70px]'
    const plusIcon = compact
        ? 'text-black absolute bottom-[4px] right-[6px] bg-white rounded-full w-[15px] h-[15px]'
        : 'text-black absolute bottom-[8px] right-[10px] bg-white rounded-full w-[19px] h-[19px]'
    const textSize = compact ? 'text-[11px]' : 'text-[14px]'
    const wrapWidth = compact ? 'w-[58px]' : 'w-[80px]'

    return (
    <div className={`flex flex-col ${wrapWidth} items-center`}>
        <div className={`${outer} rounded-full flex justify-center items-center relative ${
            !story
            ? ''
            : viewed
                ? 'bg-gradient-to-b from-gray-500 to-black-800'
                : 'bg-gradient-to-b from-blue-500 to-blue-800'
        }`}
             onClick={handleClick}>

            <div className={`${inner} border-2 border-black rounded-full cursor-pointer overflow-hidden`}>
                <img src={ProfileImage || profile} alt="" className='w-full h-full object-cover' />

                {!story && userName === 'Ваша история' && (
                    <FiPlusCircle className={plusIcon} />
                )}
            </div>
        </div>

        <div className={`${textSize} text-center truncate w-full text-white mt-1`}>{userName}</div>
    </div>
)
}

export default StoryDp
