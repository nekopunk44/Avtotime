import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { serverURL } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setProfileData } from '../redux/userSlice'
import profile from '../assets/profile.png'
import FollowButton from '../components/social/FollowButton'
import { setMessages, setSelectedUser } from '../redux/messageSlice'
import { FaInstagram, FaLink, FaMapMarkerAlt, FaTelegramPlane } from 'react-icons/fa'
import { BsGrid3X3, BsBookmark, BsPlayBtn, BsImages } from 'react-icons/bs'
import PostModal from '../components/social/PostModal'

const getPostMediaList = (post) => {
    if (Array.isArray(post?.mediaList) && post.mediaList.length) return post.mediaList
    if (post?.media) return [post.media]
    return []
}

function GridThumb({ post, onClick }) {
    const isVideo = post?.mediaType === 'video'
    const [pressing, setPressing] = useState(false)
    const mediaList = getPostMediaList(post)
    const coverMedia = mediaList[0] || ''

    const handleClick = () => {
        setPressing(true)
        setTimeout(() => {
            setPressing(false)
            onClick()
        }, 180)
    }

    return (
        <div
            className='relative aspect-square overflow-hidden cursor-pointer group bg-white/[0.04]'
            onClick={handleClick}
            style={{
                transform: pressing ? 'scale(0.94)' : 'scale(1)',
                transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {isVideo ? (
                <>
                    <video src={coverMedia} className='w-full h-full object-cover' muted playsInline preload='metadata' />
                    <div className='absolute top-2 right-2 text-white drop-shadow-lg'>
                        <BsPlayBtn className='w-4 h-4' />
                    </div>
                </>
            ) : (
                <img src={coverMedia} alt='' className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105' />
            )}
            {!isVideo && mediaList.length > 1 && (
                <div className='absolute top-2 right-2 text-white drop-shadow-lg flex items-center gap-1'>
                    <BsImages className='w-4 h-4' />
                    <span className='text-[11px] font-semibold'>{mediaList.length}</span>
                </div>
            )}
            <div className={`absolute inset-0 transition-colors duration-300 ${pressing ? 'bg-white/20' : 'bg-black/0 group-hover:bg-black/30'}`} />
        </div>
    )
}

function Profile() {
    const { userName } = useParams()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const [postType, setPostType] = useState('posts')
    const [modalIndex, setModalIndex] = useState(null)
    const { profileData, userData } = useSelector(state => state.user)
    const { postData } = useSelector(state => state.post)
    const [showReviewNotice, setShowReviewNotice] = useState(false)

    const isOwnProfile = Boolean(userData?.userName && userName && userData.userName === userName)

    const handleProfile = async () => {
        try {
            const result = await axios.get(`${serverURL}/api/user/getProfile/${encodeURIComponent(userName)}`, { withCredentials: true })
            dispatch(setProfileData(result.data))
        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    useEffect(() => {
        handleProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userName])

    useEffect(() => {
        if (!location?.state?.profileReview) return
        setShowReviewNotice(true)
        const timer = setTimeout(() => setShowReviewNotice(false), 5000)
        return () => clearTimeout(timer)
    }, [location?.state?.profileReview])

    const professionText = profileData?.profession || ''
    const bioText = (profileData?.bio || '').trim()
    const locationText = (profileData?.location || '').trim()
    const websiteText = (profileData?.website || '').trim()
    const instagramText = (profileData?.instagram || '').trim()
    const telegramText = (profileData?.telegram || '').trim()

    const normalizeWebsite = (raw) => {
        const v = String(raw || '').trim()
        if (!v) return ''
        return /^https?:\/\//i.test(v) ? v : `https://${v}`
    }
    const cleanHandle = (raw) => String(raw || '').trim().replace(/^@/, '').replace(/\s+/g, '')

    const profileId = profileData?._id
    const avatarSrc = profileData?.profileImage || profile

    const postsCount = profileData?.posts?.length || 0
    const followersCount = profileData?.followers?.length || 0
    const followingCount = profileData?.following?.length || 0

    const userPosts = postData.filter(post => post.author?._id === profileId)

    const tabs = isOwnProfile
        ? [
            { id: 'posts', icon: <BsGrid3X3 className='w-[18px] h-[18px]' />, label: 'Публикации' },
            { id: 'saved', icon: <BsBookmark className='w-[18px] h-[18px]' />, label: 'Сохранённое' },
        ]
        : [
            { id: 'posts', icon: <BsGrid3X3 className='w-[18px] h-[18px]' />, label: 'Публикации' },
        ]

    const displayedPosts = postType === 'saved'
        ? (profileData?.saved || []).filter(p => p && typeof p === 'object' && p._id)
        : userPosts

    return (
        <div className='w-full min-h-screen bg-[#080a0d]'>
            {showReviewNotice && (
                <div className='fixed top-[92px] left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl border border-white/10 bg-black/80 backdrop-blur text-gray-100 text-[13px]'>
                    Профиль находится на проверке
                </div>
            )}

            {modalIndex !== null && displayedPosts.length > 0 && (
                <PostModal
                    posts={displayedPosts}
                    startIndex={modalIndex}
                    onClose={() => setModalIndex(null)}
                />
            )}

            <div className='sticky top-0 z-30 bg-[#080a0d]/90 backdrop-blur-md border-b border-white/[0.05]'>
                <div className='max-w-[935px] mx-auto flex items-center justify-center h-[50px]'>
                    <span className='text-white/90 font-semibold text-[14px] tracking-wide'>
                        {profileData?.userName || userName}
                    </span>
                </div>
            </div>

            <div className='max-w-[935px] mx-auto'>
                <div className='relative h-[160px] overflow-hidden'>
                    <img src={avatarSrc} alt='' className='absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40 select-none pointer-events-none' />
                    <div className='absolute inset-0 bg-gradient-to-t from-[#080a0d] via-[#080a0d]/30 to-transparent' />
                    <div className='absolute inset-0 bg-gradient-to-b from-[#080a0d]/60 to-transparent' />
                </div>

                <div className='flex justify-center -mt-[56px] mb-4 relative z-10'>
                    <div className='relative'>
                        <div
                            className='w-[108px] h-[108px] rounded-full p-[3px] shadow-[0_0_32px_rgba(168,85,247,0.4)]'
                            style={{ background: 'conic-gradient(from 180deg, #a855f7 0%, #3b82f6 40%, #ec4899 70%, #a855f7 100%)' }}
                        >
                            <div className='w-full h-full rounded-full overflow-hidden border-[3px] border-[#080a0d]'>
                                <img src={avatarSrc} alt='avatar' className='w-full h-full object-cover' />
                            </div>
                        </div>
                        <div className='absolute bottom-1 right-1 w-[15px] h-[15px] rounded-full bg-emerald-400 border-[2.5px] border-[#080a0d]' />
                    </div>
                </div>

                <div className='flex flex-col items-center text-center px-6 mb-5'>
                    <h1 className='text-white font-bold text-[20px] leading-tight'>
                        {profileData?.name || profileData?.userName || '-'}
                    </h1>
                    <div className='text-gray-500 text-[13px] mt-0.5'>@{profileData?.userName || userName}</div>

                    {professionText && (
                        <div className='mt-2 px-3 py-[3px] rounded-full bg-white/[0.07] border border-white/10 text-gray-300 text-[12px] font-medium'>
                            {professionText}
                        </div>
                    )}
                    {bioText && (
                        <p className='text-gray-300 text-[13px] mt-3 leading-relaxed max-w-[340px] whitespace-pre-line'>{bioText}</p>
                    )}
                    {(locationText || websiteText || instagramText || telegramText) && (
                        <div className='flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3'>
                            {locationText && (
                                <span className='inline-flex items-center gap-1 text-gray-400 text-[12px]'>
                                    <FaMapMarkerAlt className='w-3 h-3 text-gray-500' />{locationText}
                                </span>
                            )}
                            {websiteText && (
                                <a href={normalizeWebsite(websiteText)} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 text-blue-400 text-[12px] hover:text-blue-300 transition-colors'>
                                    <FaLink className='w-3 h-3' />{websiteText}
                                </a>
                            )}
                            {instagramText && (
                                <a href={`https://instagram.com/${cleanHandle(instagramText)}`} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 text-pink-400 text-[12px] hover:text-pink-300 transition-colors'>
                                    <FaInstagram className='w-3 h-3' />@{cleanHandle(instagramText)}
                                </a>
                            )}
                            {telegramText && (
                                <a href={`https://t.me/${cleanHandle(telegramText)}`} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 text-sky-400 text-[12px] hover:text-sky-300 transition-colors'>
                                    <FaTelegramPlane className='w-3 h-3' />@{cleanHandle(telegramText)}
                                </a>
                            )}
                        </div>
                    )}
                </div>

                <div className='flex items-center justify-center gap-0 mb-5 mx-5'>
                    {[
                        { value: postsCount, label: 'публикации' },
                        { value: followersCount, label: 'подписчики' },
                        { value: followingCount, label: 'подписки' },
                    ].map((s, i) => (
                        <React.Fragment key={s.label}>
                            {i > 0 && <div className='w-px h-9 bg-white/[0.08]' />}
                            <div className='flex-1 flex flex-col items-center py-2'>
                                <span className='text-white font-bold text-[22px] leading-none'>{s.value}</span>
                                <span className='text-gray-500 text-[11px] mt-1.5 tracking-wide'>{s.label}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                <div className='px-5 mb-6'>
                    {isOwnProfile ? (
                        <div className='flex gap-2'>
                            <button className='flex-1 py-[9px] rounded-xl bg-white/[0.09] hover:bg-white/[0.14] text-white text-[13px] font-semibold transition-all border border-white/[0.08] active:scale-[0.98]' onClick={() => navigate('/editprofile')}>
                                Редактировать профиль
                            </button>
                            <button className='flex-1 py-[9px] rounded-xl bg-white/[0.09] hover:bg-white/[0.14] text-white text-[13px] font-semibold transition-all border border-white/[0.08] active:scale-[0.98]'>
                                Поделиться
                            </button>
                        </div>
                    ) : (
                        <div className='flex gap-2'>
                            <FollowButton
                                tailwind='flex-1 py-[9px] rounded-xl text-[13px] font-semibold transition-all bg-[#0095f6] hover:bg-[#1aa3ff] text-white active:scale-[0.98]'
                                targetUserId={profileId}
                                onFollowChange={handleProfile}
                            />
                            <button
                                className='flex-1 py-[9px] rounded-xl bg-white/[0.09] hover:bg-white/[0.14] text-white text-[13px] font-semibold transition-all border border-white/[0.08] active:scale-[0.98]'
                                onClick={() => { dispatch(setSelectedUser(profileData)); dispatch(setMessages([])); navigate('/messages') }}
                            >
                                Сообщение
                            </button>
                        </div>
                    )}
                </div>

                <div className='flex border-t border-white/[0.07]'>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setPostType(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-[11px] text-[12px] font-semibold transition-all border-t-[1.5px] ${postType === tab.id ? 'border-white text-white' : 'border-transparent text-gray-600 hover:text-gray-400'}`}
                        >
                            {tab.icon}
                            <span className='hidden sm:inline'>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {displayedPosts.length > 0 ? (
                    <div className='grid grid-cols-3 gap-[2px] px-[16px] sm:px-0'>
                        {displayedPosts.map((post, i) => (
                            <GridThumb key={post?._id || i} post={post} onClick={() => setModalIndex(i)} />
                        ))}
                    </div>
                ) : (
                    <div className='py-20 flex flex-col items-center gap-4 text-center px-6'>
                        <div className='w-16 h-16 rounded-full border border-white/10 flex items-center justify-center bg-white/[0.03]'>
                            <BsGrid3X3 className='w-7 h-7 text-white/20' />
                        </div>
                        <div>
                            <div className='text-white font-bold text-[17px]'>Нет публикаций</div>
                            <div className='text-gray-600 text-[13px] mt-1.5'>
                                {postType === 'saved' ? 'Сохраняйте понравившиеся посты' : 'Поделитесь первым моментом'}
                            </div>
                        </div>
                    </div>
                )}

                <div className='pb-[100px]' />
            </div>
        </div>
    )
}

export default Profile
