import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import LeftHome from '../components/layout/LeftHome'
import Feed from '../components/social/Feed'
import Messages from './Messages'
import ChatPane from '../components/messages/ChatPane.jsx'
import { setMessages, setSelectedUser } from '../redux/messageSlice'

function Home() {
    const dispatch = useDispatch()
    const { selectedUser } = useSelector((state) => state.message)
    const isChatOpen = Boolean(selectedUser?._id)

    const handleCloseChat = () => {
        dispatch(setSelectedUser(null))
        dispatch(setMessages([]))
    }

    return(
        <div className='w-full flex justify-center items-start'>
            {!isChatOpen ? <LeftHome /> : null}

            {/* Mobile */}
            <div className='w-full lg:hidden'>
                <Feed />
            </div>

            {/* Desktop (animated switch Feed -> Chat) */}
            <div className={['hidden lg:block h-[100vh] relative overflow-hidden bg-black', isChatOpen ? 'w-full' : 'w-[75%]'].join(' ')}>
                {/* Feed panel */}
                <div
                    className='absolute inset-y-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'
                    style={{
                        left: 0,
                        width: '66.6667%',
                        opacity: isChatOpen ? 0 : 1,
                        transform: isChatOpen ? 'translateX(-24px)' : 'translateX(0px)',
                        pointerEvents: isChatOpen ? 'none' : 'auto',
                    }}
                >
                    <Feed />
                </div>

                {/* Dialogs panel (moves from right -> left) */}
                <div
                    className='absolute inset-y-0 transition-[left,width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] border-l border-gray-900 bg-black'
                    style={{
                        left: isChatOpen ? 0 : '66.6667%',
                        width: isChatOpen ? 360 : '33.3333%',
                    }}
                >
                    <Messages mode="sidebar" />
                </div>

                {/* Chat panel (appears on the right) */}
                <div
                    className='absolute inset-y-0 transition-[left,width,opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] bg-black border-l border-gray-900'
                    style={{
                        left: isChatOpen ? 360 : '100%',
                        width: isChatOpen ? 'calc(100% - 360px)' : 0,
                        opacity: isChatOpen ? 1 : 0,
                        transform: isChatOpen ? 'translateX(0px)' : 'translateX(24px)',
                        pointerEvents: isChatOpen ? 'auto' : 'none',
                    }}
                >
                    <ChatPane showBack={true} onBack={handleCloseChat} />
                </div>
            </div>
        </div>
    )
}

export default Home
