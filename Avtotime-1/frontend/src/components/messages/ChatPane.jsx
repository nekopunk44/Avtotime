import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MdOutlineKeyboardBackspace } from 'react-icons/md'
import { LuPaperclip } from 'react-icons/lu'
import { IoMdSend } from 'react-icons/io'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'

import SenderMessage from '../social/SenderMessage'
import ReceiverMessage from '../social/ReceiverMessage'
import profile from '../../assets/profile.png'
import { serverURL } from '../../App'
import { setMessages } from '../../redux/messageSlice'

function ChatPane({ showBack = false, onBack }) {
    const { selectedUser, messages } = useSelector(state => state.message)
    const { userData } = useSelector(state => state.user)

    const dispatch = useDispatch()

    const [input, setInput] = useState('')
    const [attachmentPreview, setAttachmentPreview] = useState(null)
    const [attachmentFile, setAttachmentFile] = useState(null)

    const imageInput = useRef()
    const scrollContainerRef = useRef()
    const attachmentMeta = useMemo(() => {
        const f = attachmentFile
        if (!f) return { isImage: false, name: '' }
        const isImage = typeof f.type === 'string' && f.type.startsWith('image/')
        return { isImage, name: f.name || 'Файл' }
    }, [attachmentFile])

    const scrollToBottom = () => {
        const container = scrollContainerRef.current
        if (!container) return
        container.scrollTo({
            top: container.scrollHeight,
            behavior: messages?.length <= 1 ? 'auto' : 'smooth',
        })
    }

    useEffect(() => {
        const timer = setTimeout(() => scrollToBottom(), 100)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages])

    const handleAttachment = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setAttachmentFile(file)
        if (typeof file.type === 'string' && file.type.startsWith('image/')) {
            setAttachmentPreview(URL.createObjectURL(file))
        } else {
            setAttachmentPreview(null)
        }
    }

    const getAllMessages = async (userId) => {
        try {
            const result = await axios.get(`${serverURL}/api/message/getAll/${userId}`, { withCredentials: true })
            dispatch(setMessages(Array.isArray(result.data) ? result.data : []))
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        if (!selectedUser?._id) return
        dispatch(setMessages([]))
        setInput('')
        setAttachmentPreview(null)
        setAttachmentFile(null)
        if (imageInput.current) imageInput.current.value = null
        getAllMessages(selectedUser._id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUser?._id])

    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!selectedUser?._id) return
        if (!input && !attachmentFile) return

        try {
            const formData = new FormData()
            formData.append('message', input)
            if (attachmentFile) {
                formData.append(attachmentMeta.isImage ? 'image' : 'file', attachmentFile)
            }

            const result = await axios.post(`${serverURL}/api/message/send/${selectedUser._id}`, formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            dispatch(setMessages([...(messages || []), result.data]))
            setInput('')
            setAttachmentPreview(null)
            setAttachmentFile(null)
            if (imageInput.current) imageInput.current.value = null
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <div className='w-full h-full bg-black relative flex flex-col overflow-hidden'>
            {/* Header */}
            <div className='flex-none w-full flex items-center gap-4 px-5 h-[80px] bg-black border-b border-gray-900'>
                {showBack ? (
                    <button
                        type='button'
                        className='lg:hidden inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl hover:bg-white/5'
                        onClick={onBack}
                        aria-label='Назад'
                        title='Назад'
                    >
                        <MdOutlineKeyboardBackspace className='text-white w-6 h-6' />
                    </button>
                ) : null}

                <div className='w-10 h-10 rounded-full overflow-hidden cursor-pointer'>
                    <img src={selectedUser?.profileImage || profile} alt='' className='w-full h-full object-cover' />
                </div>
                <div className='text-white min-w-0'>
                    <div className='text-lg font-semibold truncate'>{selectedUser?.userName || 'Выберите диалог'}</div>
                    <div className='text-sm text-gray-400 truncate'>{selectedUser?.name || ''}</div>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollContainerRef} className='flex-grow w-full px-4 sm:px-10 overflow-y-auto flex flex-col gap-6 bg-black py-5'>
                {selectedUser?._id ? (
                    <>
                        {(messages || []).map((mess) =>
                            mess.sender === userData?._id ? (
                                <SenderMessage key={mess._id} message={mess} />
                            ) : (
                                <ReceiverMessage key={mess._id} message={mess} />
                            ),
                        )}
                        <div className='min-h-[20px] w-full' />
                    </>
                ) : (
                    <div className='flex-1 flex items-center justify-center text-gray-500 text-[14px]'>
                        Выберите диалог слева
                    </div>
                )}
            </div>

            {/* Input */}
            <div className='flex-none w-full h-[100px] bg-black flex justify-center items-center p-4'>
                <form
                    onSubmit={handleSendMessage}
                    className='w-full max-w-[800px] h-[60px] rounded-full bg-[#1a1a1a] border border-gray-800 flex items-center gap-3 px-5 relative'
                >
                    {attachmentPreview ? (
                        <div className='absolute -top-[120px] right-4 w-[100px] h-[100px] rounded-xl overflow-hidden border-2 border-purple-600'>
                            <img src={attachmentPreview} alt='' className='w-full h-full object-cover' />
                        </div>
                    ) : null}
                    {attachmentFile && !attachmentPreview ? (
                        <div className='absolute -top-[74px] right-4 max-w-[260px] rounded-2xl border border-gray-800 bg-[#0e1316] px-4 py-3 text-[13px] text-gray-200'>
                            <div className='font-semibold text-white truncate'>{attachmentMeta.name}</div>
                            <div className='text-gray-500 text-[12px] mt-[2px]'>Файл будет отправлен вместе с сообщением</div>
                        </div>
                    ) : null}

                    <input type='file' hidden ref={imageInput} onChange={handleAttachment} />
                    <input
                        type='text'
                        placeholder='Сообщение'
                        className='w-full h-full bg-transparent outline-none text-white text-lg px-2 disabled:text-gray-500'
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={!selectedUser?._id}
                    />
                    <LuPaperclip
                        className={['w-7 h-7', selectedUser?._id ? 'text-white cursor-pointer hover:text-purple-500' : 'text-gray-600 cursor-not-allowed'].join(' ')}
                        onClick={() => (selectedUser?._id ? imageInput.current?.click() : null)}
                    />
                    {selectedUser?._id && (input || attachmentFile) ? (
                        <button
                            type='submit'
                            className='w-[45px] h-[45px] rounded-full bg-gradient-to-br from-[#9500ff] to-[#ff0095] flex items-center justify-center shrink-0'
                        >
                            <IoMdSend className='text-white w-5 h-5' />
                        </button>
                    ) : null}
                </form>
            </div>
        </div>
    )
}

export default ChatPane
