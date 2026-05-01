import axios from 'axios'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { GoHeart, GoHeartFill } from 'react-icons/go'
import { MdOutlineComment, MdOutlineBookmarkBorder, MdOutlineBookmark } from 'react-icons/md'
import { IoCloseOutline, IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5'
import { serverURL } from '../../App'
import { setPostData } from '../../redux/postSlice'
import { setUserData } from '../../redux/userSlice'
import { setModalOpen } from '../../redux/uiSlice'
import profile from '../../assets/profile.png'

const getPostMediaList = (post) => {
    if (Array.isArray(post?.mediaList) && post.mediaList.length) return post.mediaList
    if (post?.media) return [post.media]
    return []
}

function PostModal({ posts, startIndex = 0, onClose }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { userData } = useSelector(state => state.user)
    const { postData } = useSelector(state => state.post)
    const commentEndRef = useRef(null)
    const touchStartX = useRef(null)

    const [index, setIndex] = useState(startIndex)
    const [localPost, setLocalPost] = useState(posts[startIndex])
    const [mediaIndex, setMediaIndex] = useState(0)
    const [comment, setComment] = useState('')
    const [likeLoading, setLikeLoading] = useState(false)
    const [visible, setVisible] = useState(false)
    const [closing, setClosing] = useState(false)
    const [slideDir, setSlideDir] = useState(null)

    const hasPrev = index > 0
    const hasNext = index < posts.length - 1
    const mediaList = getPostMediaList(localPost)
    const hasPrevMedia = mediaIndex > 0
    const hasNextMedia = mediaIndex < mediaList.length - 1

    useEffect(() => {
        setLocalPost(posts[index])
        setComment('')
        setMediaIndex(0)
    }, [index, posts])

    useEffect(() => {
        commentEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [localPost?.comments])

    useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        dispatch(setModalOpen(true))
        return () => {
            document.body.style.overflow = ''
            dispatch(setModalOpen(false))
        }
    }, [])

    const animatedClose = () => {
        setClosing(true)
        setTimeout(onClose, 260)
    }

    const goTo = (nextIndex, dir) => {
        setSlideDir(dir)
        setTimeout(() => {
            setIndex(nextIndex)
            setSlideDir(null)
        }, 220)
    }

    const goToMedia = (nextMediaIndex) => {
        setMediaIndex(nextMediaIndex)
    }

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') animatedClose()
            if (e.key === 'ArrowLeft') {
                if (hasPrevMedia) goToMedia(mediaIndex - 1)
                else if (hasPrev) goTo(index - 1, 'right')
            }
            if (e.key === 'ArrowRight') {
                if (hasNextMedia) goToMedia(mediaIndex + 1)
                else if (hasNext) goTo(index + 1, 'left')
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [hasPrev, hasNext, hasPrevMedia, hasNextMedia, index, mediaIndex])

    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        touchStartX.current = null
        if (dx < -50) {
            if (hasNextMedia) goToMedia(mediaIndex + 1)
            else if (hasNext) goTo(index + 1, 'left')
        } else if (dx > 50) {
            if (hasPrevMedia) goToMedia(mediaIndex - 1)
            else if (hasPrev) goTo(index - 1, 'right')
        }
    }

    const isLiked = localPost?.likes?.some(id => String(id) === String(userData?._id))
    const isSaved = userData?.saved?.some(item =>
        (typeof item === 'string' ? item : item?._id) === localPost?._id
    )
    const comments = Array.isArray(localPost?.commentsPreview)
        ? localPost.commentsPreview
        : (Array.isArray(localPost?.comments) ? localPost.comments : [])

    const resolveAvatar = (user) => {
        if (user?._id && userData?._id && String(user._id) === String(userData._id))
            return userData?.profileImage || profile
        return user?.profileImage || profile
    }

    const syncPost = (updated) => {
        setLocalPost(updated)
        dispatch(setPostData(postData.map(p => p._id === updated._id ? updated : p)))
    }

    const handleLike = async () => {
        if (likeLoading) return
        setLikeLoading(true)
        try {
            const { data } = await axios.get(`${serverURL}/api/post/like/${localPost._id}`, { withCredentials: true })
            syncPost(data)
        } catch (e) { console.error(e) }
        finally { setLikeLoading(false) }
    }

    const handleComment = async () => {
        if (!comment.trim()) return
        try {
            const { data } = await axios.post(`${serverURL}/api/post/comment/${localPost._id}`, { message: comment }, { withCredentials: true })
            syncPost(data)
            setComment('')
        } catch (e) { console.error(e) }
    }

    const handleSave = async () => {
        try {
            const { data } = await axios.get(`${serverURL}/api/post/saved/${localPost._id}`, { withCredentials: true })
            dispatch(setUserData(data))
        } catch (e) { console.error(e) }
    }

    if (!localPost) return null

    const overlayVisible = visible && !closing
    const currentMedia = mediaList[mediaIndex] || localPost.media

    const cardStyle = {
        height: 'min(88vh, 700px)',
        transform: closing
            ? 'scale(0.90) translateY(20px)'
            : visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(24px)',
        opacity: closing ? 0 : visible ? 1 : 0,
        transition: closing
            ? 'transform 240ms ease-in, opacity 220ms ease-in'
            : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease',
    }

    const mediaStyle = {
        transform: slideDir === 'left' ? 'translateX(-60px)' : slideDir === 'right' ? 'translateX(60px)' : 'translateX(0)',
        opacity: slideDir ? 0 : 1,
        transition: slideDir
            ? 'transform 200ms ease-in, opacity 180ms ease-in'
            : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out',
    }

    const panelStyle = {
        opacity: slideDir ? 0 : 1,
        transition: slideDir ? 'opacity 160ms ease-in' : 'opacity 240ms ease-out',
    }

    return createPortal(
        <div
            className='fixed inset-0 z-[200] flex items-center justify-center px-4 py-6'
            style={{
                backgroundColor: overlayVisible ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0)',
                backdropFilter: overlayVisible ? 'blur(6px)' : 'blur(0px)',
                transition: 'background-color 280ms ease, backdrop-filter 280ms ease',
            }}
            onClick={animatedClose}
        >
            <button
                className='absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
                onClick={animatedClose}
            >
                <IoCloseOutline className='w-5 h-5' />
            </button>

            <div
                className='relative flex w-full max-w-[900px] bg-white rounded-2xl overflow-hidden shadow-2xl'
                style={cardStyle}
                onClick={e => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className='relative bg-black flex items-center justify-center flex-1 min-w-0 overflow-hidden'>
                    {hasPrev && !hasPrevMedia && (
                        <button
                            className='absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors'
                            onClick={e => { e.stopPropagation(); goTo(index - 1, 'right') }}
                        >
                            <IoChevronBackOutline className='w-5 h-5' />
                        </button>
                    )}
                    {hasPrevMedia && (
                        <button
                            className='absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors'
                            onClick={e => { e.stopPropagation(); goToMedia(mediaIndex - 1) }}
                        >
                            <IoChevronBackOutline className='w-5 h-5' />
                        </button>
                    )}
                    {hasNextMedia && (
                        <button
                            className='absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors'
                            onClick={e => { e.stopPropagation(); goToMedia(mediaIndex + 1) }}
                        >
                            <IoChevronForwardOutline className='w-5 h-5' />
                        </button>
                    )}
                    {hasNext && !hasNextMedia && (
                        <button
                            className='absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors'
                            onClick={e => { e.stopPropagation(); goTo(index + 1, 'left') }}
                        >
                            <IoChevronForwardOutline className='w-5 h-5' />
                        </button>
                    )}
                    <div className='w-full h-full' style={mediaStyle}>
                        {localPost.mediaType === 'video' ? (
                            <video key={`${localPost._id}-${mediaIndex}`} src={currentMedia} className='w-full h-full object-contain' controls autoPlay muted loop />
                        ) : (
                            <img key={`${localPost._id}-${mediaIndex}`} src={currentMedia} alt='' className='w-full h-full object-contain' />
                        )}
                    </div>
                    {mediaList.length > 1 && (
                        <div className='absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5'>
                            {mediaList.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={e => { e.stopPropagation(); goToMedia(i) }}
                                    className={`rounded-full transition-all duration-300 ${i === mediaIndex ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className='flex flex-col w-[320px] shrink-0 border-l border-gray-100 min-h-0' style={panelStyle}>
                    <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0'>
                        <img
                            src={resolveAvatar(localPost.author)}
                            alt=''
                            className='w-9 h-9 rounded-full object-cover cursor-pointer shrink-0'
                            onClick={() => { animatedClose(); navigate(`/profile/${localPost.author?.userName}`) }}
                        />
                        <span
                            className='font-semibold text-[14px] cursor-pointer hover:underline truncate'
                            onClick={() => { animatedClose(); navigate(`/profile/${localPost.author?.userName}`) }}
                        >
                            {localPost.author?.userName}
                        </span>
                    </div>

                    {localPost.caption && (
                        <div className='px-4 py-3 border-b border-gray-100 shrink-0'>
                            <span className='font-semibold text-[13px] mr-2'>{localPost.author?.userName}</span>
                            <span className='text-[13px] text-gray-700 leading-relaxed'>{localPost.caption}</span>
                        </div>
                    )}

                    <div className='flex-1 overflow-y-auto px-4 py-3 min-h-0'>
                        {comments.length === 0 ? (
                            <div className='h-full flex flex-col items-center justify-center text-center gap-2'>
                                <MdOutlineComment className='w-10 h-10 text-gray-200' />
                                <div className='font-semibold text-[14px] text-gray-800'>Пока нет комментариев</div>
                                <div className='text-[12px] text-gray-400'>Оставьте первый комментарий</div>
                            </div>
                        ) : (
                            comments.map((c, i) => (
                                <div key={i} className='flex gap-2.5 mb-3 items-start'>
                                    <img src={resolveAvatar(c.author)} alt='' className='w-7 h-7 rounded-full object-cover shrink-0 mt-0.5' />
                                    <div className='text-[13px] leading-snug'>
                                        <span className='font-semibold mr-1.5'>{c.author?.userName}</span>
                                        <span className='text-gray-700'>{c.message}</span>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={commentEndRef} />
                    </div>

                    <div className='px-4 pt-3 pb-2 border-t border-gray-100 shrink-0'>
                        <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-3'>
                                <button onClick={handleLike} disabled={likeLoading} className='transition-transform active:scale-90'>
                                    {isLiked
                                        ? <GoHeartFill className='w-6 h-6 text-red-500' />
                                        : <GoHeart className='w-6 h-6 text-gray-800' />
                                    }
                                </button>
                                <div className='flex items-center gap-1 text-gray-700'>
                                    <MdOutlineComment className='w-6 h-6' />
                                    <span className='text-[13px] font-medium'>{comments.length}</span>
                                </div>
                            </div>
                            <button onClick={handleSave} className='transition-transform active:scale-90'>
                                {isSaved
                                    ? <MdOutlineBookmark className='w-6 h-6 text-gray-900' />
                                    : <MdOutlineBookmarkBorder className='w-6 h-6 text-gray-600' />
                                }
                            </button>
                        </div>
                        {localPost.likes?.length > 0 && (
                            <div className='text-[12px] font-semibold text-gray-900 mt-1.5'>
                                {localPost.likes.length} {localPost.likes.length === 1 ? 'отметка' : 'отметок'} "Нравится"
                            </div>
                        )}
                    </div>

                    <div className='flex items-center gap-2 px-4 py-3 border-t border-gray-100 shrink-0'>
                        <img src={userData?.profileImage || profile} alt='' className='w-8 h-8 rounded-full object-cover shrink-0' />
                        <input
                            type='text'
                            className='flex-1 bg-gray-100 rounded-full px-4 py-2 text-[13px] outline-none placeholder-gray-400 min-w-0'
                            placeholder='Добавьте комментарий...'
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleComment()}
                        />
                        <button
                            className='text-[#0095f6] text-[13px] font-semibold disabled:opacity-30 shrink-0'
                            onClick={handleComment}
                            disabled={!comment.trim()}
                        >
                            Опубл.
                        </button>
                    </div>
                </div>
            </div>

            {posts.length > 1 && (
                <div className='absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5'>
                    {posts.map((_, i) => (
                        <button
                            key={i}
                            onClick={e => { e.stopPropagation(); goTo(i, i > index ? 'left' : 'right') }}
                            className={`rounded-full transition-all duration-300 ${i === index ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'}`}
                        />
                    ))}
                </div>
            )}
        </div>,
        document.body
    )
}

export default PostModal
