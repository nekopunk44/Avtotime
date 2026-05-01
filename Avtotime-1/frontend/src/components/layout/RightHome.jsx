import React from 'react'
import Messages from '../../pages/Messages'

function RightHome() {
    return(
        <div className='w-[25%] min-h-[100vh] bg-[black] border-l-2 border-gray-900 hidden lg:block'>
            <Messages mode="sidebar" />
            </div>
    )
}

export default RightHome
