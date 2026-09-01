import React, { useEffect, useState } from 'react'
import { MdOutlineKeyboardBackspace } from "react-icons/md";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import profile from '../assets/profile.png'
import { serverURL } from '../config/serverUrl';
import { setProfileData, setUserData } from '../redux/userSlice';
import { ClipLoader } from 'react-spinners';
import axios from 'axios';
import { AvatarPicker } from '../components/ui';

function EditProfile() {
    const { userData } = useSelector(state => state.user)
    const navigate = useNavigate()

    const [backendImage, setBackendImage] = useState(null)
    const [imageError, setImageError] = useState('')

    const [name, setName] = useState(userData?.name || '')
    const [userName, setUserName] = useState(userData?.userName || '')
    const [bio, setBio] = useState(userData?.bio || '')
    const [profession, setProfession] = useState(userData?.profession || '')
    const [gender, setGender] = useState(userData?.gender || '')
    const [location, setLocation] = useState(userData?.location || '')

    const dispatch = useDispatch()
    const [loading, setLoading] = useState(false)
    const [submitError, setSubmitError] = useState('')

    useEffect(() => {
        const normalizeGender = (raw) => {
            const v = String(raw ?? '').trim().toLowerCase()
            if (!v) return ''
            if (v === 'male' || v === 'm' || v === 'мужской' || v === 'мужчина') return 'male'
            if (v === 'female' || v === 'f' || v === 'женский' || v === 'женщина') return 'female'
            return ''
        }

        setName(userData?.name || '')
        setUserName(userData?.userName || '')
        setBio(userData?.bio || '')
        setProfession(userData?.profession || '')
        setGender(normalizeGender(userData?.gender))
        setLocation(userData?.location || '')
    }, [userData])

    const handlePickImage = (file) => {
        setImageError('')
        if (!file) return

        if (!file.type?.startsWith('image/')) {
            setImageError('Можно загрузить только изображение')
            return
        }

        const maxBytes = 6 * 1024 * 1024
        if (file.size > maxBytes) {
            setImageError('Слишком большой файл (макс. 6MB)')
            return
        }

        setBackendImage(file)
    }

    const handleClearImage = () => {
        setBackendImage(null)
        setImageError('')
    }

    const handleEditProfile = async () => {
        if (loading) return
        setSubmitError('')
        setLoading(true)
        try {
            const formdata = new FormData()
            formdata.append('name', name)
            formdata.append('userName', userName)
            formdata.append('bio', bio)
            formdata.append('profession', profession)
            formdata.append('gender', gender)
            formdata.append('location', location)

            if (backendImage) {
                formdata.append('profileImage', backendImage)
            }

            const result = await axios.post(`${serverURL}/api/user/editProfile`, formdata, { withCredentials: true })
            dispatch(setProfileData(result.data))
            dispatch(setUserData(result.data))
            navigate(`/profile/${result.data?.userName || userData?.userName}`, { state: { profileReview: true } })
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Ошибка сохранения профиля'
            setSubmitError(String(message))
            if (String(message).toLowerCase().includes('фотограф')) {
                setBackendImage(null)
                setImageError(String(message))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='w-full min-h-screen bg-black flex flex-col'>
            <div className='w-full h-[80px] flex items-center gap-[20px] px-[20px]'>
                <MdOutlineKeyboardBackspace
                    className='text-white cursor-pointer w-[25px] h-[25px]'
                    onClick={() => navigate(`/profile/${userData?.userName}`)}
                />
                <h1 className='text-white text-[20px] font-semibold'>Редактировать профиль</h1>
            </div>

            <div className='w-full flex-1 flex items-center justify-center px-[16px] py-[18px]'>
                <div className='w-full max-w-[1200px]'>
                    <div className='relative overflow-hidden rounded-[28px] border border-gray-900 bg-[#050708] min-h-[420px] md:min-h-[480px]'>
                        <div className='absolute inset-0 bg-gradient-to-br from-blue-900/25 via-black to-purple-900/20' />
                        <div className='absolute -top-[120px] -left-[120px] w-[260px] h-[260px] rounded-full bg-blue-600/15 blur-3xl' />
                        <div className='absolute -bottom-[140px] -right-[140px] w-[320px] h-[320px] rounded-full bg-purple-600/15 blur-3xl' />

                        <div className='relative p-[20px] md:p-[26px]'>
                            <div className='grid grid-cols-1 md:grid-cols-[420px_1fr] gap-[18px] md:gap-[26px]'>
                            <div className='flex flex-col gap-[14px]'>
                                <div className='text-white font-semibold text-[16px]'>Фото профиля</div>
                                <div className='w-full flex justify-center'>
                                    <AvatarPicker
                                        value={userData?.profileImage || profile}
                                        file={backendImage}
                                        onPick={handlePickImage}
                                        onClear={handleClearImage}
                                        disabled={loading}
                                        error={imageError}
                                    />
                                </div>
                            </div>

                            <div className='flex flex-col gap-[12px]'>
                                <div className='text-white font-semibold text-[16px]'>Информация</div>

                                <div className='grid grid-cols-1 md:grid-cols-2 gap-[12px]'>
                                    <input
                                        type='text'
                                        className='w-full h-[56px] text-white font-semibold bg-[#0a1010] border border-gray-700 rounded-2xl px-[18px] outline-none focus:border-blue-600/70'
                                        placeholder='Введите своё имя'
                                        onChange={(e) => setName(e.target.value)}
                                        value={name}
                                        disabled={loading}
                                    />

                                    <input
                                        type='text'
                                        className='w-full h-[56px] text-white font-semibold bg-[#0a1010] border border-gray-700 rounded-2xl px-[18px] outline-none focus:border-blue-600/70'
                                        placeholder='Введите username'
                                        onChange={(e) => setUserName(e.target.value)}
                                        value={userName}
                                        disabled={loading}
                                    />
                                </div>

                                <div className='grid grid-cols-1 gap-[12px] pt-[2px]'>
                                    <input
                                        type='text'
                                        className='w-full h-[56px] text-white font-semibold bg-[#0a1010] border border-gray-700 rounded-2xl px-[18px] outline-none focus:border-blue-600/70'
                                        placeholder='Город'
                                        onChange={(e) => setLocation(e.target.value)}
                                        value={location}
                                        disabled={loading}
                                    />
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-2 gap-[12px]'>
                                    <input
                                        type='text'
                                        className='w-full h-[56px] text-white font-semibold bg-[#0a1010] border border-gray-700 rounded-2xl px-[18px] outline-none focus:border-blue-600/70'
                                        placeholder='Профессия'
                                        onChange={(e) => setProfession(e.target.value)}
                                        value={profession}
                                        disabled={loading}
                                    />

                                    <select
                                        className='w-full h-[56px] text-white font-semibold bg-[#0a1010] border border-gray-700 rounded-2xl px-[18px] outline-none focus:border-blue-600/70'
                                        onChange={(e) => setGender(e.target.value)}
                                        value={gender}
                                        disabled={loading}
                                    >
                                        <option value='' className='bg-black'>Пол</option>
                                        <option value='male' className='bg-black'>Мужской</option>
                                        <option value='female' className='bg-black'>Женский</option>
                                    </select>
                                </div>

                                <div className='flex flex-col gap-[6px] pt-[2px]'>
                                    <textarea
                                        className='w-full min-h-[92px] resize-none text-white font-semibold bg-[#0a1010] border border-gray-700 rounded-2xl px-[18px] py-[14px] outline-none focus:border-blue-600/70'
                                        placeholder='О себе'
                                        onChange={(e) => setBio(e.target.value)}
                                        value={bio}
                                        disabled={loading}
                                        maxLength={160}
                                    />
                                    <div className='text-right text-[12px] text-gray-500'>
                                        {String(bio || '').length}/160
                                    </div>
                                </div>

                            </div>
                        </div>

                        {submitError ? (
                            <div className='mt-[18px] text-center text-[13px] text-red-400'>
                                {submitError}
                            </div>
                        ) : null}

                        <div className='flex flex-col sm:flex-row items-center justify-center gap-[10px] mt-[26px] mb-[4px]'>
                            <button
                                type='button'
                                className='w-full sm:w-auto px-[18px] py-[10px] rounded-2xl border border-gray-800 text-gray-200 hover:text-white hover:border-gray-700 transition-colors'
                                onClick={() => navigate(`/profile/${userData?.userName}`)}
                                disabled={loading}
                            >
                                Отмена
                            </button>
                            <button
                                className='w-full sm:w-auto px-[18px] py-[10px] rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors min-w-[190px] flex items-center justify-center'
                                onClick={handleEditProfile}
                                disabled={loading}
                            >
                                {loading ? <ClipLoader size={22} color='black' /> : 'Сохранить профиль'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    )
}

export default EditProfile
