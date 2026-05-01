import axios from 'axios'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { serverURL } from '../App'
import Post from '../components/social/Post'
import profileFallback from '../assets/profile.png'

function Search() {
    const navigate = useNavigate()
    const { userData } = useSelector(state => state.user)
    const { postData } = useSelector(state => state.post)

    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [postResults, setPostResults] = useState([])
    const [userResults, setUserResults] = useState([])
    const [error, setError] = useState('')

    const normalizedQuery = useMemo(() => String(query || '').trim(), [query])

    useEffect(() => {
        const q = normalizedQuery
        setError('')

        if (q.length < 2) {
            setLoading(false)
            setPostResults([])
            setUserResults([])
            return
        }

        let cancelled = false
        const id = setTimeout(async () => {
            try {
                setLoading(true)

                const [usersRes, postsRes] = await Promise.allSettled([
                    axios.get(`${serverURL}/api/user/search?q=${encodeURIComponent(q)}`, { withCredentials: true }),
                    axios.get(`${serverURL}/api/post/search?q=${encodeURIComponent(q)}`, { withCredentials: true }),
                ])

                if (cancelled) return

                if (usersRes.status === 'fulfilled') {
                    setUserResults(Array.isArray(usersRes.value.data) ? usersRes.value.data : [])
                } else {
                    setUserResults([])
                }

                if (postsRes.status === 'fulfilled') {
                    setPostResults(Array.isArray(postsRes.value.data) ? postsRes.value.data : [])
                } else {
                    // fallback: client-side filter from store
                    const filtered = (postData || []).filter(p =>
                        String(p?.caption || '').toLowerCase().includes(q.toLowerCase())
                    )
                    setPostResults(filtered.slice(0, 30))
                }
            } catch (e) {
                if (cancelled) return
                setError(e?.response?.data?.message || 'Ошибка поиска')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }, 350)

        return () => {
            cancelled = true
            clearTimeout(id)
        }
    }, [normalizedQuery, postData])

    const hasResults = userResults.length > 0 || postResults.length > 0

    return (
        <div className='w-full min-h-[100vh] bg-black flex flex-col items-center pb-[120px]'>
            <div className='w-full h-[80px] flex items-center justify-center px-[20px]'>
                <h1 className='text-white text-[20px] font-bold'>Поиск</h1>
            </div>

            <div className='w-[90%] max-w-[600px] mt-[14px] flex flex-col items-center'>
                <div className='w-full rounded-2xl bg-[#0e1316] border-gray-800 border-2 flex items-center gap-[10px] px-[14px] py-[6px]'>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='Поиск по людям и постам…'
                        className='flex-1 bg-transparent text-white outline-none placeholder:text-gray-500 text-[14px]'
                        autoComplete='off'
                    />
                    <button
                        type='button'
                        className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0 ${query ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                        onClick={() => setQuery('')}
                    >
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' className='w-[14px] h-[14px]'>
                            <line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' />
                        </svg>
                    </button>
                </div>

                <div className='w-full mt-[16px]'>
                    {normalizedQuery.length < 2 ? (
                        <div className='text-gray-400 text-[14px] text-center py-[26px]'>
                            Введите минимум 2 символа для поиска
                        </div>
                    ) : null}

                    {error ? (
                        <div className='text-red-300 text-[14px] text-center py-[20px]'>{error}</div>
                    ) : null}

                    {loading ? (
                        <div className='text-gray-300 text-[14px] text-center py-[20px]'>Идёт поиск…</div>
                    ) : null}

                    {!loading && !error && normalizedQuery.length >= 2 ? (
                        <>
                            {/* Users section */}
                            {userResults.length > 0 ? (
                                <div className='mb-[24px]'>
                                    <div className='text-gray-400 text-[12px] font-semibold uppercase tracking-wider mb-[10px] px-[2px]'>
                                        Аккаунты
                                    </div>
                                    <div className='flex flex-col gap-[8px]'>
                                        {userResults.map(u => (
                                            <button
                                                key={u?._id || u?.userName}
                                                type='button'
                                                className='w-full text-left rounded-2xl bg-[#0e1316] border-gray-800 border-2 flex items-center gap-[12px] px-[14px] py-[12px] cursor-pointer hover:bg-[#353a3d] transition-colors'
                                                onClick={() => navigate(`/profile/${u?.userName}`)}
                                            >
                                                <div className='w-[44px] h-[44px] rounded-full overflow-hidden border border-white/10 bg-black shrink-0'>
                                                    <img src={u?.profileImage || profileFallback} alt='' className='w-full h-full object-cover' />
                                                </div>
                                                <div className='min-w-0'>
                                                    <div className='text-white font-semibold text-[14px] truncate'>{u?.name || '—'}</div>
                                                    <div className='text-gray-400 text-[13px] truncate'>@{u?.userName}</div>
                                                    {u?.profession ? <div className='text-gray-500 text-[12px] truncate mt-[2px]'>{u.profession}</div> : null}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Posts section */}
                            {postResults.length > 0 ? (
                                <div>
                                    <div className='text-gray-400 text-[12px] font-semibold uppercase tracking-wider mb-[10px] px-[2px]'>
                                        Посты
                                    </div>
                                    <div className='flex flex-col gap-[16px]'>
                                        {postResults.map((p, idx) => (
                                            <Post key={p?._id || idx} post={p} />
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {!hasResults ? (
                                <div className='text-gray-400 text-[14px] text-center py-[22px]'>Ничего не найдено</div>
                            ) : null}
                        </>
                    ) : null}
                </div>
            </div>

        </div>
    )
}

export default Search
