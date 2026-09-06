import React, { useRef, useState } from 'react'
import profile from '../../assets/profile.png'
import VideoPlayer from '../media/VideoPlayer'
import { GoHeart, GoHeartFill } from "react-icons/go";
import { MdOutlineComment, MdOutlineBookmarkBorder, MdOutlineBookmark } from "react-icons/md";
import { IoSendSharp } from "react-icons/io5";
import { HiOutlineDotsHorizontal } from "react-icons/hi";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { serverURL } from '../../config/serverUrl';
import { setPostData } from '../../redux/postSlice';
import { setUserData } from '../../redux/userSlice';
import FollowButton from './FollowButton';
import PostModal from './PostModal'
import ReportDialog from '../common/ReportDialog';

const getPostMediaList = (post) => {
    if (Array.isArray(post?.mediaList) && post.mediaList.length) return post.mediaList
    if (post?.media) return [post.media]
    return []
}

function Post({ post }) {
    const { userData } = useSelector(state => state.user)
    const { postData } = useSelector(state => state.post)
    const [showComment, setShowComment] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [message, setMessage] = useState('')
    const [showMenu, setShowMenu] = useState(false)
    const [showReport, setShowReport] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editCaption, setEditCaption] = useState(post?.caption || '')
    const menuRef = useRef(null)
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const isOwn = userData?._id && post.author?._id && String(userData._id) === String(post.author._id)
    const comments = Array.isArray(post?.commentsPreview) ? post.commentsPreview : (Array.isArray(post?.comments) ? post.comments : [])
    const commentsCount = typeof post?.commentsCount === 'number' ? post.commentsCount : comments.length
    const mediaList = getPostMediaList(post)
    const coverMedia = mediaList[0] || ''

    const resolveAvatar = (user) => {
        const userId = user?._id
        const myId = userData?._id
        if (userId && myId && String(userId) === String(myId)) {
            return userData?.profileImage || user?.profileImage || profile
        }
        return user?.profileImage || profile
    }

    const handleLike = async () => {
        try {
            const result = await axios.get(`${serverURL}/api/post/like/${post._id}`, { withCredentials: true })
            dispatch(setPostData(postData.map(p => p._id === post._id ? result.data : p)))
        } catch (error) {
            console.log(error)
        }
    }

    const handleComment = async () => {
        if (!message.trim()) return
        try {
            const result = await axios.post(`${serverURL}/api/post/comment/${post._id}`, { message }, { withCredentials: true })
            dispatch(setPostData(postData.map(p => p._id === post._id ? result.data : p)))
            setMessage('')
        } catch (error) {
            console.log(error)
        }
    }

    const handleSaved = async () => {
        try {
            const result = await axios.get(`${serverURL}/api/post/saved/${post._id}`, { withCredentials: true })
            dispatch(setUserData(result.data))
        } catch (error) {
            console.log(error)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Удалить пост?')) return
        try {
            await axios.delete(`${serverURL}/api/post/delete/${post._id}`, { withCredentials: true })
            dispatch(setPostData(postData.filter(p => p._id !== post._id)))
        } catch (error) {
            console.log(error)
        }
        setShowMenu(false)
    }

    const handleEdit = async () => {
        try {
            const result = await axios.patch(`${serverURL}/api/post/edit/${post._id}`, { caption: editCaption }, { withCredentials: true })
            dispatch(setPostData(postData.map(p => p._id === post._id ? result.data : p)))
            setEditing(false)
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <>
        {showModal && (
            <PostModal posts={[post]} startIndex={0} onClose={() => setShowModal(false)} />
        )}
        <div className='w-[98%] sm:w-[95%] max-w-[720px] flex flex-col bg-white border border-gray-800 shadow-xl rounded-[32px] overflow-hidden pb-2 mb-6'>
            <div className='w-full h-[60px] flex justify-between items-center px-4'>
                <div className='flex items-center gap-3 cursor-pointer' onClick={() => navigate(`/profile/${post.author?.userName}`)}>
                    <div className='w-[40px] h-[40px] border border-gray-200 rounded-full overflow-hidden'>
                        <img src={resolveAvatar(post.author)} alt="avatar" className='w-full h-full object-cover' />
                    </div>
                    <div className='font-bold text-[15px]'>{post.author?.userName}</div>
                </div>

                {isOwn ? (
                    <div className='relative' ref={menuRef}>
                        <button
                            className='p-2 rounded-full hover:bg-gray-100 transition-colors'
                            onClick={() => setShowMenu(prev => !prev)}
                        >
                            <HiOutlineDotsHorizontal className='w-5 h-5 text-gray-600' />
                        </button>
                        {showMenu && (
                            <div className='absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-[160px]'>
                                <button
                                    className='w-full px-4 py-3 text-left text-[13px] font-medium hover:bg-gray-50 transition-colors'
                                    onClick={() => { setEditing(true); setEditCaption(post.caption || ''); setShowMenu(false) }}
                                >
                                    Редактировать
                                </button>
                                <button
                                    className='w-full px-4 py-3 text-left text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors'
                                    onClick={handleDelete}
                                >
                                    Удалить
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className='flex items-center gap-1'>
                        <FollowButton
                            tailwind='px-4 py-1.5 bg-black text-white rounded-lg text-[13px] font-medium'
                            targetUserId={post.author?._id}
                        />
                        <div className='relative' ref={menuRef}>
                            <button
                                className='p-2 rounded-full hover:bg-gray-100 transition-colors'
                                onClick={() => setShowMenu(prev => !prev)}
                            >
                                <HiOutlineDotsHorizontal className='w-5 h-5 text-gray-600' />
                            </button>
                            {showMenu && (
                                <div className='absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-[180px]'>
                                    <button
                                        className='w-full px-4 py-3 text-left text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors'
                                        onClick={() => { setShowReport(true); setShowMenu(false) }}
                                    >
                                        Пожаловаться
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showReport && (
                <ReportDialog
                    targetType='post'
                    targetId={post._id}
                    onClose={() => setShowReport(false)}
                />
            )}

            <div className='w-full bg-gray-50 overflow-hidden cursor-pointer' onClick={() => setShowModal(true)}>
                {post.mediaType === 'image' && mediaList.length > 1 ? (
                    <div className='grid grid-cols-2 gap-[2px] h-[400px] bg-white'>
                        {mediaList.slice(0, 4).map((item, index) => (
                            <div key={`${item}-${index}`} className={`relative overflow-hidden ${mediaList.length === 3 && index === 0 ? 'row-span-2' : ''}`}>
                                <img src={item} alt='post' className='w-full h-full object-cover block' />
                                {index === 3 && mediaList.length > 4 && (
                                    <div className='absolute inset-0 bg-black/45 flex items-center justify-center text-white text-[28px] font-semibold'>
                                        +{mediaList.length - 4}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : post.mediaType === 'image' ? (
                    <div className='w-full h-[400px]'>
                        <img src={coverMedia} alt='post' className='w-full h-full object-cover block' />
                    </div>
                ) : (
                    <div className='w-full h-[400px]'>
                        <VideoPlayer media={coverMedia} />
                    </div>
                )}
            </div>

            <div className='w-full flex justify-between items-center px-4 pt-3'>
                <div className='flex items-center gap-4'>
                    <div className='flex items-center gap-1.5'>
                        {post.likes.includes(userData?._id) ? (
                            <GoHeartFill className='w-7 h-7 cursor-pointer text-red-500 scale-110 transition-transform' onClick={handleLike} />
                        ) : (
                            <GoHeart className='w-7 h-7 cursor-pointer hover:text-gray-600' onClick={handleLike} />
                        )}
                        <span className='font-medium text-sm'>{post.likes?.length}</span>
                    </div>
                    <div className='flex items-center gap-1.5 cursor-pointer' onClick={() => setShowComment(prev => !prev)}>
                        <MdOutlineComment className='w-7 h-7 hover:text-gray-600' />
                        <span className='font-medium text-sm'>{commentsCount}</span>
                    </div>
                </div>
                <div onClick={handleSaved} className="cursor-pointer">
                    {userData?.saved?.some(item => (typeof item === 'string' ? item : item._id) === post?._id) ? (
                        <MdOutlineBookmark className='w-7 h-7 text-black' />
                    ) : (
                        <MdOutlineBookmarkBorder className='w-7 h-7 text-black' />
                    )}
                </div>
            </div>

            <div className='w-full px-4 mt-2'>
                {editing ? (
                    <div className='flex flex-col gap-2'>
                        <textarea
                            className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-gray-400 transition-colors'
                            rows={3}
                            value={editCaption}
                            onChange={e => setEditCaption(e.target.value)}
                        />
                        <div className='flex gap-2'>
                            <button
                                className='px-4 py-1.5 bg-black text-white rounded-lg text-[12px] font-medium'
                                onClick={handleEdit}
                            >
                                Сохранить
                            </button>
                            <button
                                className='px-4 py-1.5 border border-gray-200 rounded-lg text-[12px] font-medium text-gray-600'
                                onClick={() => setEditing(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                ) : post.caption ? (
                    <div className='text-sm pb-1'>
                        <span className='font-bold mr-2'>{post.author?.userName}</span>
                        <span>{post.caption}</span>
                    </div>
                ) : null}
            </div>

            {showComment && (
                <div className='w-full mt-3 border-t border-gray-100'>
                    <div className='flex items-center gap-3 p-3'>
                        <div className='w-8 h-8 rounded-full overflow-hidden shrink-0'>
                            <img src={userData?.profileImage || profile} alt="me" className='w-full h-full object-cover' />
                        </div>
                        <div className='flex-1 relative'>
                            <input
                                type="text"
                                className='w-full bg-gray-100 rounded-full px-4 py-2 text-sm outline-none pr-10'
                                placeholder='Добавьте комментарий...'
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                            />
                            <button
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 disabled:opacity-50'
                                onClick={handleComment}
                                disabled={!message.trim()}
                            >
                                <IoSendSharp className='w-4 h-4' />
                            </button>
                        </div>
                    </div>
                    <div className='max-h-[200px] overflow-y-auto px-4'>
                        {comments.map((com, index) => (
                            <div key={index} className='flex gap-3 mb-3 items-start'>
                                <div className='w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5'>
                                    <img src={resolveAvatar(com.author)} alt="" className='w-full h-full object-cover' />
                                </div>
                                <div className='text-xs'>
                                    <span className='font-bold mr-2'>{com.author?.userName}</span>
                                    <span className='text-gray-800'>{com.message}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        </>
    );
}

export default Post;
