import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlusSquare, FiX } from 'react-icons/fi'
import { ClipLoader } from 'react-spinners'
import axios from 'axios'
import { useDispatch, useSelector } from 'react-redux'

import { serverURL } from '../App'
import VideoPlayer from '../components/media/VideoPlayer'
import { setPostData } from '../redux/postSlice'
import { setCurrentUserStory } from '../redux/storySlice'
import { setLoopData } from '../redux/loopSlice'

const POST_IMAGE_LIMIT = 8

const getUploadButtonLabel = (uploadType) => {
    if (uploadType === 'post') return 'Опубликовать пост'
    if (uploadType === 'story') return 'Опубликовать историю'
    return 'Опубликовать видео'
}

const getEmptyStateTitle = (uploadType) => {
    if (uploadType === 'post') return 'Выберите фото или видео'
    if (uploadType === 'story') return 'Выберите фото или видео для истории'
    return 'Выберите видео'
}

const getEmptyStateHint = (uploadType) => {
    if (uploadType === 'post') {
        return 'Можно добавить до 8 фото в один пост или загрузить одно видео.'
    }
    if (uploadType === 'story') {
        return 'История поддерживает одно фото или одно видео.'
    }
    return 'Загрузите одно видео для публикации.'
}

const getPreviewSummary = (isImageSet, imageCount) => {
    if (!isImageSet) return 'Выбрано 1 видео'
    if (imageCount === 1) return 'Выбрано 1 фото'
    return `Выбрано ${imageCount} фото`
}

const getImageGridClass = (imageCount) => {
    if (imageCount === 1) return 'grid-cols-1'
    if (imageCount === 2) return 'grid-cols-2'
    return 'grid-cols-2 sm:grid-cols-3'
}

const getImageTileClass = (imageCount, index) => {
    if (imageCount === 1) return 'h-[320px] sm:h-[420px]'
    if (imageCount === 2) return 'aspect-[0.82]'
    if ((imageCount === 3 || imageCount === 5) && index === 0) {
        return 'sm:col-span-2 sm:row-span-2 sm:min-h-[268px] sm:aspect-auto aspect-square'
    }
    return 'aspect-square'
}

const COLLAGE_PREVIEW_LIMIT = 5

function Upload() {
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const uploadTabs = useMemo(() => ([
        { key: 'post', label: 'Пост' },
        { key: 'story', label: 'История' },
        { key: 'loop', label: 'Видео' },
    ]), [])

    const [uploadType, setUploadType] = useState('post')
    const [selectedFiles, setSelectedFiles] = useState([])
    const [frontendMedia, setFrontendMedia] = useState([])
    const [mediaType, setMediaType] = useState('')
    const [caption, setCaption] = useState('')
    const [isVideoVertical, setIsVideoVertical] = useState(false)
    const [loading, setLoading] = useState(false)

    const mediaInput = useRef()
    const tabsRef = useRef(null)
    const [activeTabRect, setActiveTabRect] = useState({ left: 0, width: 0 })

    const { postData } = useSelector((state) => state.post)
    const { loopData } = useSelector((state) => state.loop)

    const resetSelection = () => {
        setSelectedFiles([])
        setFrontendMedia([])
        setMediaType('')
        setCaption('')
        setIsVideoVertical(false)
        if (mediaInput.current) mediaInput.current.value = ''
    }

    useEffect(() => {
        return () => {
            frontendMedia.forEach((item) => {
                if (item?.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
            })
        }
    }, [frontendMedia])

    const handleMedia = (e) => {
        const files = Array.from(e.target.files || [])
        if (!files.length) return

        const canAppendImages =
            uploadType === 'post' &&
            mediaType === 'image' &&
            selectedFiles.length > 0 &&
            files.every((file) => file.type.includes('image'))

        const baseFiles = canAppendImages ? selectedFiles : []
        const incomingFiles = uploadType === 'post' ? files : [files[0]]
        const pickedFiles = [...baseFiles, ...incomingFiles].slice(0, uploadType === 'post' ? POST_IMAGE_LIMIT : 1)

        const hasImage = pickedFiles.some((file) => file.type.includes('image'))
        const hasVideo = pickedFiles.some((file) => file.type.includes('video'))

        if (uploadType === 'loop' && hasImage) {
            alert('Для раздела "Видео" можно загружать только видеофайлы!')
            e.target.value = ''
            return
        }

        if (uploadType === 'post' && hasImage && hasVideo) {
            alert('Для поста выберите либо несколько фото, либо одно видео.')
            e.target.value = ''
            return
        }

        if (uploadType === 'post' && hasVideo && pickedFiles.length > 1) {
            alert('Видеопост можно загрузить только одним файлом.')
            e.target.value = ''
            return
        }

        const nextType = hasVideo ? 'video' : 'image'

        if (canAppendImages) {
            const nextPreview = [...frontendMedia]
            const filesToAppend = pickedFiles.slice(baseFiles.length)
            filesToAppend.forEach((file, index) => {
                nextPreview.push({
                    id: `${file.name}-${file.lastModified}-${frontendMedia.length + index}`,
                    url: URL.createObjectURL(file),
                    type: 'image',
                    name: file.name,
                })
            })

            setMediaType('image')
            setSelectedFiles(pickedFiles)
            setFrontendMedia(nextPreview)
            setIsVideoVertical(false)
            if (mediaInput.current) mediaInput.current.value = ''
            return
        }

        const previews = pickedFiles.map((file, index) => ({
            id: `${file.name}-${file.lastModified}-${index}`,
            url: URL.createObjectURL(file),
            type: file.type.includes('video') ? 'video' : 'image',
            name: file.name,
        }))

        if (nextType === 'video' && pickedFiles[0]) {
            const video = document.createElement('video')
            video.src = previews[0].url
            video.onloadedmetadata = () => setIsVideoVertical(video.videoHeight > video.videoWidth)
        } else {
            setIsVideoVertical(false)
        }

        setMediaType(nextType)
        setSelectedFiles(pickedFiles)
        setFrontendMedia(previews)
        if (mediaInput.current) mediaInput.current.value = ''
    }

    const removeSelectedMedia = (indexToRemove) => {
        const removed = frontendMedia[indexToRemove]
        if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)

        const nextFiles = selectedFiles.filter((_, index) => index !== indexToRemove)
        const nextPreview = frontendMedia.filter((_, index) => index !== indexToRemove)

        setSelectedFiles(nextFiles)
        setFrontendMedia(nextPreview)

        if (nextFiles.length === 0) {
            setMediaType('')
            setIsVideoVertical(false)
            if (mediaInput.current) mediaInput.current.value = ''
        }
    }

    const uploadPost = async () => {
        try {
            const formData = new FormData()
            formData.append('caption', caption)
            formData.append('mediaType', mediaType)
            selectedFiles.forEach((file) => formData.append('media', file))

            const result = await axios.post(`${serverURL}/api/post/upload`, formData, { withCredentials: true })
            dispatch(setPostData([result.data, ...(postData || [])]))
            navigate('/')
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const uploadStory = async () => {
        try {
            const formData = new FormData()
            formData.append('mediaType', mediaType)
            formData.append('media', selectedFiles[0])

            const result = await axios.post(`${serverURL}/api/story/upload`, formData, { withCredentials: true })
            dispatch(setCurrentUserStory(result.data))
            navigate('/')
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const uploadLoop = async () => {
        try {
            const formData = new FormData()
            formData.append('caption', caption)
            formData.append('media', selectedFiles[0])
            formData.append('mediaType', 'video')

            const result = await axios.post(`${serverURL}/api/loop/upload`, formData, { withCredentials: true })
            dispatch(setLoopData([...(loopData || []), result.data]))
            navigate('/')
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = () => {
        if (!selectedFiles.length) return
        setLoading(true)

        if (uploadType === 'post') return uploadPost()
        if (uploadType === 'story') return uploadStory()
        return uploadLoop()
    }

    useLayoutEffect(() => {
        const update = () => {
            const root = tabsRef.current
            if (!root) return
            const active = root.querySelector(`[data-tab="${uploadType}"]`)
            if (!active) return
            const next = { left: active.offsetLeft, width: active.offsetWidth }
            setActiveTabRect((prev) => (prev.left === next.left && prev.width === next.width ? prev : next))
        }

        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [uploadType])

    const hasMedia = frontendMedia.length > 0
    const isImageSet = mediaType === 'image'
    const imageCount = frontendMedia.length
    const collageItems = frontendMedia.slice(0, COLLAGE_PREVIEW_LIMIT)
    const hiddenItemsCount = Math.max(0, imageCount - COLLAGE_PREVIEW_LIMIT)

    return (
        <div className='flex min-h-[100vh] w-full flex-col items-center bg-black px-4 pb-[120px]'>
            <input
                type='file'
                accept={uploadType === 'loop' ? 'video/*' : 'image/*,video/*'}
                multiple={uploadType === 'post'}
                hidden
                ref={mediaInput}
                onChange={handleMedia}
            />

            <div className='flex h-[80px] w-full items-center justify-center'>
                <h1 className='text-[20px] font-bold text-white'>Загрузить медиа</h1>
            </div>

            <div
                ref={tabsRef}
                className='relative flex h-[60px] w-full max-w-[540px] items-center gap-[6px] rounded-full bg-white p-[5px]'
            >
                <div
                    className='absolute bottom-[5px] top-[5px] rounded-full bg-black shadow-2xl shadow-black transition-[left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
                    style={{ left: `${activeTabRect.left}px`, width: `${activeTabRect.width}px` }}
                />

                {uploadTabs.map(({ key, label }) => (
                    <button
                        key={key}
                        type='button'
                        data-tab={key}
                        className={[
                            'relative z-10 flex h-full flex-1 items-center justify-center rounded-full font-semibold transition-colors',
                            'text-[15px] sm:text-[16px]',
                            uploadType === key ? 'text-white' : 'text-black hover:text-black/80',
                        ].join(' ')}
                        onClick={() => {
                            setUploadType(key)
                            resetSelection()
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {!hasMedia ? (
                <div
                    className='mt-[10vh] flex min-h-[270px] w-full max-w-[540px] cursor-pointer flex-col items-center justify-center gap-[10px] rounded-[28px] border-2 border-gray-800 bg-[#0e1316] px-6 text-center transition-colors hover:bg-[#171d22]'
                    onClick={() => mediaInput.current?.click()}
                >
                    <FiPlusSquare className='h-[28px] w-[28px] text-white' />
                    <div className='text-[20px] font-semibold text-white'>
                        {getEmptyStateTitle(uploadType)}
                    </div>
                    <div className='max-w-[320px] text-[14px] leading-5 text-gray-400'>
                        {getEmptyStateHint(uploadType)}
                    </div>
                </div>
            ) : (
                <div className='mt-10 flex w-full max-w-[540px] flex-col items-center gap-5'>
                    {isImageSet ? (
                        <div className='w-full'>
                            {imageCount <= 4 ? (
                                <div
                                    className={[
                                        'grid w-full gap-2',
                                        getImageGridClass(imageCount),
                                        imageCount >= 3 ? 'sm:auto-rows-[130px]' : '',
                                    ].join(' ')}
                                >
                                    {collageItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className={[
                                                'relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1316]',
                                                getImageTileClass(imageCount, index),
                                            ].join(' ')}
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.name}
                                                className='h-full w-full object-cover'
                                                referrerPolicy='no-referrer'
                                            />
                                            {uploadType === 'post' && (
                                                <button
                                                    type='button'
                                                    className='absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80'
                                                    onClick={() => removeSelectedMedia(index)}
                                                >
                                                    <FiX className='h-4 w-4' />
                                                </button>
                                            )}
                                            {imageCount > 1 && (
                                                <div className='absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white'>
                                                    {index + 1}/{imageCount}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='grid w-full grid-cols-12 gap-2 sm:auto-rows-[126px]'>
                                    {collageItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className={[
                                                'relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1316]',
                                                index === 0
                                                    ? 'col-span-7 row-span-2 min-h-[260px]'
                                                    : 'col-span-5 min-h-[126px]',
                                            ].join(' ')}
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.name}
                                                className='h-full w-full object-cover'
                                                referrerPolicy='no-referrer'
                                            />
                                            {index === collageItems.length - 1 && hiddenItemsCount > 0 ? (
                                                <div className='absolute inset-0 flex items-center justify-center bg-black/45'>
                                                    <div className='rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white'>
                                                        +{hiddenItemsCount} фото
                                                    </div>
                                                </div>
                                            ) : null}
                                            {uploadType === 'post' && (
                                                <button
                                                    type='button'
                                                    className='absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80'
                                                    onClick={() => removeSelectedMedia(index)}
                                                >
                                                    <FiX className='h-4 w-4' />
                                                </button>
                                            )}
                                            <div className='absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white'>
                                                {index + 1}/{imageCount}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {imageCount > 1 ? (
                                <div className='mt-3 flex gap-2 overflow-x-auto pb-1'>
                                    {frontendMedia.map((item, index) => (
                                        <div
                                            key={`${item.id}-thumb`}
                                            className='relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1316]'
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.name}
                                                className='h-full w-full object-cover'
                                                referrerPolicy='no-referrer'
                                            />
                                            <button
                                                type='button'
                                                className='absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80'
                                                onClick={() => removeSelectedMedia(index)}
                                            >
                                                <FiX className='h-3 w-3' />
                                            </button>
                                            <div className='absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white'>
                                                {index + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div
                            style={{ width: isVideoVertical ? '220px' : '100%' }}
                            className='flex max-w-full flex-col items-center justify-center'
                        >
                            <div className='relative w-full'>
                                <VideoPlayer media={frontendMedia[0]?.url} />
                                <button
                                    type='button'
                                    className='absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80'
                                    onClick={() => removeSelectedMedia(0)}
                                >
                                    <FiX className='h-4 w-4' />
                                </button>
                            </div>
                        </div>
                    )}

                    {uploadType !== 'story' ? (
                        <div className='w-full rounded-[24px] border border-white/10 bg-[#101418] px-4 py-4'>
                            <div className='mb-3 flex items-center justify-between gap-3'>
                                <div className='text-[15px] font-semibold text-white'>Описание</div>
                                <div className='text-[12px] text-gray-500'>{caption.length}/280</div>
                            </div>
                            <textarea
                                className='min-h-[112px] w-full resize-none bg-transparent text-[15px] leading-6 text-white outline-none placeholder:text-gray-500'
                                placeholder={
                                    uploadType === 'post'
                                        ? 'Добавьте подпись, настроение или короткий контекст к публикации...'
                                        : 'Добавьте описание к видео...'
                                }
                                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                                value={caption}
                            />
                        </div>
                    ) : null}

                    <div className='flex w-full items-center gap-3 text-[12px] text-gray-400'>
                        {uploadType === 'post' && isImageSet && imageCount < POST_IMAGE_LIMIT ? (
                            <button
                                type='button'
                                className='h-[42px] rounded-full border border-white/10 px-4 text-white transition-colors hover:bg-white/8'
                                onClick={() => mediaInput.current?.click()}
                            >
                                Добавить еще
                            </button>
                        ) : null}
                        <div>{getPreviewSummary(isImageSet, imageCount)}</div>
                    </div>
                </div>
            )}

            {hasMedia ? (
                <button
                    className='mt-[34px] h-[54px] w-full max-w-[540px] cursor-pointer rounded-2xl bg-white px-[10px] py-[5px] text-[18px] font-medium disabled:opacity-70'
                    onClick={handleUpload}
                    disabled={loading}
                >
                    {loading ? <ClipLoader size={26} color='black' /> : getUploadButtonLabel(uploadType)}
                </button>
            ) : null}
        </div>
    )
}

export default Upload
