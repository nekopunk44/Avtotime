import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdOutlineKeyboardBackspace } from 'react-icons/md'
import { LuPaperclip } from 'react-icons/lu'
import { RiSendPlaneFill } from 'react-icons/ri'
import { BsMicFill, BsStopFill } from 'react-icons/bs'
import { HiDotsVertical } from 'react-icons/hi'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'

import SenderMessage from '../social/SenderMessage'
import ReceiverMessage from '../social/ReceiverMessage'
import profile from '../../assets/profile.png'
import { serverURL } from '../../App'
import { setMessages, setSelectedUser } from '../../redux/messageSlice'

// ─── Confirmation modal ───────────────────────────────────────────────────────
function ConfirmModal({ title, text, confirmLabel, danger, onConfirm, onCancel }) {
    return (
        <div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4'>
            <div className='w-full max-w-[340px] rounded-2xl bg-[#111] border border-gray-800 p-6 flex flex-col gap-4'>
                <div className='text-white font-semibold text-[17px]'>{title}</div>
                <div className='text-gray-400 text-[14px]'>{text}</div>
                <div className='flex gap-3 mt-1'>
                    <button
                        onClick={onCancel}
                        className='flex-1 h-[44px] rounded-xl border border-gray-700 text-white text-[14px] hover:bg-white/5'
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 h-[44px] rounded-xl text-white text-[14px] font-semibold ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Voice recorder hook ──────────────────────────────────────────────────────
function useVoiceRecorder() {
    const [recording, setRecording] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const [audioBlob, setAudioBlob] = useState(null)
    const [audioPreviewUrl, setAudioPreviewUrl] = useState(null)
    const mediaRef = useRef(null)
    const chunksRef = useRef([])
    const timerRef = useRef(null)

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
            const mr = new MediaRecorder(stream, { mimeType })
            chunksRef.current = []
            mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop())
                const blob = new Blob(chunksRef.current, { type: mimeType })
                setAudioBlob(blob)
                setAudioPreviewUrl(URL.createObjectURL(blob))
            }
            mr.start()
            mediaRef.current = mr
            setRecording(true)
            setSeconds(0)
            timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
        } catch {
            alert('Нет доступа к микрофону')
        }
    }, [])

    const stop = useCallback(() => {
        mediaRef.current?.stop()
        clearInterval(timerRef.current)
        setRecording(false)
    }, [])

    const cancel = useCallback(() => {
        if (mediaRef.current?.state === 'recording') {
            mediaRef.current.onstop = null
            mediaRef.current.stop()
            mediaRef.current.stream?.getTracks().forEach(t => t.stop())
        }
        clearInterval(timerRef.current)
        setRecording(false)
        setSeconds(0)
        setAudioBlob(null)
        setAudioPreviewUrl(null)
    }, [])

    const clear = useCallback(() => {
        setAudioBlob(null)
        setAudioPreviewUrl(null)
        setSeconds(0)
    }, [])

    const formatTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

    return { recording, seconds, audioBlob, audioPreviewUrl, start, stop, cancel, clear, formatTime }
}

// ─── ChatPane ─────────────────────────────────────────────────────────────────
function ChatPane({ showBack = false, onBack }) {
    const { selectedUser, messages } = useSelector(state => state.message)
    const { userData } = useSelector(state => state.user)
    const dispatch = useDispatch()

    const [input, setInput] = useState('')
    const [attachmentPreview, setAttachmentPreview] = useState(null)
    const [attachmentFile, setAttachmentFile] = useState(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmBlock, setConfirmBlock] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [isBlocked, setIsBlocked] = useState(false)
    const [loading, setLoading] = useState(false)

    const fileInput = useRef()
    const scrollContainerRef = useRef()
    const menuRef = useRef()

    const voice = useVoiceRecorder()

    const attachmentMeta = useMemo(() => {
        const f = attachmentFile
        if (!f) return { isImage: false, name: '' }
        const isImage = typeof f.type === 'string' && f.type.startsWith('image/')
        return { isImage, name: f.name || 'Файл' }
    }, [attachmentFile])

    const scrollToBottom = useCallback(() => {
        const c = scrollContainerRef.current
        if (!c) return
        c.scrollTo({ top: c.scrollHeight, behavior: messages?.length <= 1 ? 'auto' : 'smooth' })
    }, [messages?.length])

    useEffect(() => {
        const t = setTimeout(scrollToBottom, 100)
        return () => clearTimeout(t)
    }, [messages, scrollToBottom])

    // Close menu on outside click
    useEffect(() => {
        const handler = e => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const fetchBlockedStatus = useCallback(async (targetId) => {
        try {
            const res = await axios.get(`${serverURL}/api/message/block/${targetId}`, { withCredentials: true })
            setIsBlocked(res.data.isBlocked)
        } catch { /* ignore */ }
    }, [])

    const getAllMessages = useCallback(async (userId) => {
        try {
            const result = await axios.get(`${serverURL}/api/message/getAll/${userId}`, { withCredentials: true })
            dispatch(setMessages(Array.isArray(result.data) ? result.data : []))
        } catch (error) {
            console.log(error)
        }
    }, [dispatch])

    useEffect(() => {
        if (!selectedUser?._id) return
        dispatch(setMessages([]))
        setInput('')
        setAttachmentPreview(null)
        setAttachmentFile(null)
        voice.cancel()
        if (fileInput.current) fileInput.current.value = null
        getAllMessages(selectedUser._id)
        fetchBlockedStatus(selectedUser._id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUser?._id])

    const handleAttachment = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setAttachmentFile(file)
        setAttachmentPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    }

    const clearAttachment = () => {
        setAttachmentFile(null)
        setAttachmentPreview(null)
        if (fileInput.current) fileInput.current.value = null
    }

    const handleSendMessage = async (e) => {
        e?.preventDefault()
        if (!selectedUser?._id) return
        if (!input && !attachmentFile && !voice.audioBlob) return

        try {
            setLoading(true)
            const formData = new FormData()
            formData.append('message', input)
            if (voice.audioBlob) {
                const ext = voice.audioBlob.type.includes('webm') ? 'webm' : 'ogg'
                formData.append('audio', voice.audioBlob, `voice.${ext}`)
            } else if (attachmentFile) {
                formData.append(attachmentMeta.isImage ? 'image' : 'file', attachmentFile)
            }

            const result = await axios.post(`${serverURL}/api/message/send/${selectedUser._id}`, formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            dispatch(setMessages([...(messages || []), result.data]))
            setInput('')
            clearAttachment()
            voice.clear()
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const handleBlock = async () => {
        setConfirmBlock(false)
        try {
            if (isBlocked) {
                await axios.delete(`${serverURL}/api/message/block/${selectedUser._id}`, { withCredentials: true })
                setIsBlocked(false)
            } else {
                await axios.post(`${serverURL}/api/message/block/${selectedUser._id}`, {}, { withCredentials: true })
                setIsBlocked(true)
            }
        } catch (error) {
            console.log(error)
        }
    }

    const handleDeleteConversation = async () => {
        setConfirmDelete(false)
        try {
            await axios.delete(`${serverURL}/api/message/conversation/${selectedUser._id}`, { withCredentials: true })
            dispatch(setMessages([]))
            dispatch(setSelectedUser(null))
        } catch (error) {
            console.log(error)
        }
    }

    const canSend = Boolean(input || attachmentFile || voice.audioBlob)
    const inputDisabled = !selectedUser?._id || voice.recording

    return (
        <div className='w-full h-full bg-black relative flex flex-col overflow-hidden'>
            {/* Modals */}
            {confirmBlock && (
                <ConfirmModal
                    title={isBlocked ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?'}
                    text={isBlocked
                        ? `${selectedUser?.userName} снова сможет отправлять вам сообщения.`
                        : `${selectedUser?.userName} больше не сможет отправлять вам сообщения.`}
                    confirmLabel={isBlocked ? 'Разблокировать' : 'Заблокировать'}
                    danger={!isBlocked}
                    onConfirm={handleBlock}
                    onCancel={() => setConfirmBlock(false)}
                />
            )}
            {confirmDelete && (
                <ConfirmModal
                    title='Удалить переписку?'
                    text='Все сообщения будут удалены безвозвратно.'
                    confirmLabel='Удалить'
                    danger
                    onConfirm={handleDeleteConversation}
                    onCancel={() => setConfirmDelete(false)}
                />
            )}

            {/* Header */}
            <div className='flex-none w-full flex items-center gap-4 px-5 h-[80px] bg-black border-b border-gray-900'>
                {showBack && (
                    <button
                        type='button'
                        className='lg:hidden inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl hover:bg-white/5'
                        onClick={onBack}
                        aria-label='Назад'
                    >
                        <MdOutlineKeyboardBackspace className='text-white w-6 h-6' />
                    </button>
                )}
                <div className='w-10 h-10 rounded-full overflow-hidden cursor-pointer shrink-0'>
                    <img src={selectedUser?.profileImage || profile} alt='' className='w-full h-full object-cover' />
                </div>
                <div className='text-white min-w-0 flex-1'>
                    <div className='text-lg font-semibold truncate'>{selectedUser?.userName || 'Выберите диалог'}</div>
                    <div className='text-sm text-gray-400 truncate'>{selectedUser?.name || ''}</div>
                </div>

                {/* 3-dot menu */}
                {selectedUser?._id && (
                    <div ref={menuRef} className='relative shrink-0'>
                        <button
                            type='button'
                            onClick={() => setMenuOpen(v => !v)}
                            className='w-[38px] h-[38px] flex items-center justify-center rounded-xl hover:bg-white/5'
                        >
                            <HiDotsVertical className='text-gray-400 w-5 h-5' />
                        </button>
                        {menuOpen && (
                            <div className='absolute right-0 top-full mt-2 w-[200px] rounded-2xl bg-[#111] border border-gray-800 overflow-hidden shadow-2xl z-50'>
                                <button
                                    type='button'
                                    onClick={() => { setMenuOpen(false); setConfirmBlock(true) }}
                                    className={`w-full px-4 py-3 text-left text-[14px] hover:bg-white/5 ${isBlocked ? 'text-green-400' : 'text-red-400'}`}
                                >
                                    {isBlocked ? 'Разблокировать' : 'Заблокировать'}
                                </button>
                                <div className='h-px bg-gray-800' />
                                <button
                                    type='button'
                                    onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                                    className='w-full px-4 py-3 text-left text-[14px] text-red-400 hover:bg-white/5'
                                >
                                    Удалить переписку
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                className='flex-grow w-full px-4 sm:px-10 overflow-y-auto flex flex-col gap-6 bg-black py-5'
            >
                {selectedUser?._id ? (
                    <>
                        {(messages || []).map(mess =>
                            mess.sender === userData?._id
                                ? <SenderMessage key={mess._id} message={mess} />
                                : <ReceiverMessage key={mess._id} message={mess} />
                        )}
                        <div className='min-h-[20px] w-full' />
                    </>
                ) : (
                    <div className='flex-1 flex items-center justify-center text-gray-500 text-[14px]'>
                        Выберите диалог слева
                    </div>
                )}
            </div>

            {/* Input bar */}
            <div className='flex-none w-full h-[100px] bg-black flex justify-center items-center p-4'>
                <form
                    onSubmit={handleSendMessage}
                    className='w-full max-w-[800px] h-[60px] rounded-full bg-[#1a1a1a] border border-gray-800 flex items-center gap-2 px-3 relative'
                >
                    {/* Attachment preview (image) */}
                    {attachmentPreview && (
                        <div
                            className='absolute -top-[120px] left-4 w-[100px] h-[100px] rounded-xl overflow-hidden border-2 border-purple-600 cursor-pointer'
                            onClick={clearAttachment}
                            title='Убрать'
                        >
                            <img src={attachmentPreview} alt='' className='w-full h-full object-cover' />
                            <div className='absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs opacity-0 hover:opacity-100'>✕</div>
                        </div>
                    )}

                    {/* Attachment preview (file) */}
                    {attachmentFile && !attachmentPreview && (
                        <div
                            className='absolute -top-[74px] left-4 max-w-[260px] rounded-2xl border border-gray-800 bg-[#0e1316] px-4 py-3 text-[13px] text-gray-200 cursor-pointer hover:border-red-500'
                            onClick={clearAttachment}
                            title='Убрать'
                        >
                            <div className='font-semibold text-white truncate'>{attachmentMeta.name}</div>
                            <div className='text-gray-500 text-[12px] mt-[2px]'>Нажмите чтобы убрать</div>
                        </div>
                    )}

                    {/* Voice preview */}
                    {voice.audioPreviewUrl && !voice.recording && (
                        <div className='absolute -top-[64px] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0e1316] border border-gray-800 rounded-2xl px-3 py-2'>
                            <audio src={voice.audioPreviewUrl} controls className='h-[36px] max-w-[220px]' />
                            <button type='button' onClick={voice.cancel} className='text-red-400 text-[12px] hover:text-red-300 shrink-0'>✕</button>
                        </div>
                    )}

                    {/* LEFT: attach file */}
                    <input type='file' hidden ref={fileInput} onChange={handleAttachment} />
                    <button
                        type='button'
                        disabled={!selectedUser?._id || voice.recording || Boolean(voice.audioBlob)}
                        onClick={() => selectedUser?._id && !voice.recording && !voice.audioBlob && fileInput.current?.click()}
                        className='shrink-0 w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <LuPaperclip className='w-[22px] h-[22px] text-gray-300' />
                    </button>

                    {/* CENTER: text input OR recording indicator */}
                    {voice.recording ? (
                        <div className='flex-1 flex items-center gap-2 text-red-400'>
                            <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                            <span className='text-[15px] font-mono'>{voice.formatTime(voice.seconds)}</span>
                            <span className='text-gray-400 text-[13px]'>Запись...</span>
                        </div>
                    ) : (
                        <input
                            type='text'
                            placeholder='Сообщение'
                            className='flex-1 h-full bg-transparent outline-none text-white text-[15px] px-1 disabled:text-gray-500 min-w-0'
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={inputDisabled || Boolean(voice.audioBlob)}
                        />
                    )}

                    {/* RIGHT: unified animated button (mic → send → stop) */}
                    <button
                        type={canSend && !voice.recording ? 'submit' : 'button'}
                        disabled={(!selectedUser?._id && !voice.recording) || loading}
                        onClick={voice.recording ? voice.stop : (!canSend ? voice.start : undefined)}
                        className='shrink-0 w-[45px] h-[45px] rounded-full relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed'
                        style={{
                            background: canSend
                                ? 'linear-gradient(135deg, #9500ff, #ff0095)'
                                : voice.recording
                                    ? '#dc2626'
                                    : '#2a2a2a',
                            transition: 'background 0.25s ease',
                        }}
                    >
                        {/* Mic */}
                        <span
                            className='absolute inset-0 flex items-center justify-center'
                            style={{
                                opacity: !canSend && !voice.recording ? 1 : 0,
                                transform: !canSend && !voice.recording ? 'scale(1)' : 'scale(0.5)',
                                transition: 'opacity 0.2s ease, transform 0.2s ease',
                            }}
                        >
                            <BsMicFill className='text-white w-4 h-4' />
                        </span>
                        {/* Send */}
                        <span
                            className='absolute inset-0 flex items-center justify-center'
                            style={{
                                opacity: canSend && !voice.recording ? 1 : 0,
                                transform: canSend && !voice.recording ? 'scale(1)' : 'scale(0.5)',
                                transition: 'opacity 0.2s ease, transform 0.2s ease',
                            }}
                        >
                            <RiSendPlaneFill className='text-white w-5 h-5' />
                        </span>
                        {/* Stop */}
                        <span
                            className='absolute inset-0 flex items-center justify-center'
                            style={{
                                opacity: voice.recording ? 1 : 0,
                                transform: voice.recording ? 'scale(1)' : 'scale(0.5)',
                                transition: 'opacity 0.2s ease, transform 0.2s ease',
                            }}
                        >
                            <BsStopFill className='text-white w-5 h-5' />
                        </span>
                    </button>
                </form>
            </div>
        </div>
    )
}

export default ChatPane
