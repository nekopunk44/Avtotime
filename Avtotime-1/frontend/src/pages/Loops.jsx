import React from 'react'
import { useSelector } from 'react-redux'

import LoopsCard from '../components/ui/LoopsCard'
function Loops() {
    const { loopData } = useSelector(state => state.loop)

    return (
        <div className='w-screen h-screen bg-black overflow-hidden'>
            <div className='fixed top-0 left-0 right-0 z-[110] px-[16px] md:px-[24px] h-[70px] flex items-center justify-center bg-gradient-to-b from-black/90 to-black/0'>
                <h1 className='text-white text-[18px] md:text-[20px] font-semibold'>Короткие видео</h1>
            </div>

            <div className='h-[100vh] overflow-y-scroll snap-y snap-mandatory scrollbar-hide pb-[120px]'>
                {(loopData || []).map(loop => (
                    <div className='h-screen snap-start' key={loop._id}>
                        <LoopsCard loop={loop} />
                    </div>
                ))}
            </div>

        </div>
    )
}

export default Loops
