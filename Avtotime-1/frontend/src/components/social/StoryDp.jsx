import React, { useEffect, useState } from 'react'
import profile from '../../assets/profile.png'
import { FiPlusCircle } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../../App';


function StoryDp({ProfileImage, userName, story}) {

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
        const result=await axios.get(`${serverURL}/api/story/view/${story._id}`, {withCredentials:true})

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



    return (
    <div className='flex flex-col w-[80px] items-center'>
        <div className={`w-[80px] h-[80px] rounded-full flex justify-center items-center relative ${
            !story 
            ? '' 
            : viewed 
                ? 'bg-gradient-to-b from-gray-500 to-black-800'
                : 'bg-gradient-to-b from-blue-500 to-blue-800'
        }`}
             onClick={handleClick}>
            
            <div className='w-[70px] h-[70px] border-2 border-black rounded-full cursor-pointer overflow-hidden'>
                <img src={ProfileImage || profile} alt="" className='w-full h-full object-cover' />
                
                {!story && userName === 'Ваша история' && (
                    <FiPlusCircle className='text-black absolute bottom-[8px] right-[10px] bg-white rounded-full w-[19px] h-[19px]' />
                )}
            </div>
        </div>

        <div className='text-[14px] text-center truncate w-full text-white mt-1'>{userName}</div>
    </div>
)
}

export default StoryDp
