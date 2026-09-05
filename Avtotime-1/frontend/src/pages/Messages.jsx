import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBack } from "react-icons/io5";
import { FiEdit3, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../config/serverUrl';
import OnlineUsers from '../components/social/OnlineUsers.jsx';
import { setMessages, setSelectedUser } from '../redux/messageSlice';
import profile from '../assets/profile.png';
import ChatPane from '../components/messages/ChatPane.jsx';

function Messages({ mode = 'page' }) {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { userData } = useSelector((state) => state.user);
    const { onlineUsers } = useSelector((state) => state.socket);
    const { selectedUser } = useSelector((state) => state.message);

    const [prevChats, setPrevChats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all'); // all | unread | online
    const filterRef = useRef(null);

    const FILTERS = [
        { key: 'all', label: 'Все' },
        { key: 'unread', label: 'Непрочитанные' },
        { key: 'online', label: 'Онлайн' },
    ];

    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerQuery, setComposerQuery] = useState('');
    const [composerLoading, setComposerLoading] = useState(false);
    const [composerError, setComposerError] = useState('');
    const [composerResults, setComposerResults] = useState([]);

    useEffect(() => {
        const fetchPrevChats = async () => {
            try {
                setIsLoading(true);
                setLoadError('');
                const result = await axios.get(`${serverURL}/api/message/prevChats/?limit=50`, { withCredentials: true });
                setPrevChats(Array.isArray(result.data) ? result.data : []);
            } catch (error) {
                console.log(error);
                setLoadError('Не удалось загрузить диалоги');
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchPrevChats();
    }, []);

    const handleOpenChat = (user) => {
        dispatch(setSelectedUser(user));
        dispatch(setMessages([]));
    };

    const handleBackToList = () => {
        dispatch(setSelectedUser(null));
        dispatch(setMessages([]));
    };

    useEffect(() => {
        const q = String(composerQuery || '').trim();
        setComposerError('');
        if (!isComposerOpen) return;
        if (q.length < 2) {
            setComposerLoading(false);
            setComposerResults([]);
            return;
        }

        let cancelled = false;
        const id = setTimeout(async () => {
            try {
                setComposerLoading(true);
                const res = await axios.get(`${serverURL}/api/user/search?q=${encodeURIComponent(q)}`, { withCredentials: true });
                if (cancelled) return;
                const arr = Array.isArray(res.data) ? res.data : [];
                const filtered = arr.filter((u) => String(u?._id) && String(u?._id) !== String(userData?._id));
                setComposerResults(filtered);
            } catch (e) {
                if (cancelled) return;
                setComposerError(e?.response?.data?.message || 'Ошибка поиска');
            } finally {
                if (!cancelled) setComposerLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [composerQuery, isComposerOpen, userData?._id]);

    const handleOpenComposer = () => {
        setIsComposerOpen(true);
        setComposerQuery('');
        setComposerError('');
        setComposerResults([]);
    };

    const handleCloseComposer = () => {
        setIsComposerOpen(false);
        setComposerQuery('');
        setComposerError('');
        setComposerResults([]);
    };

    const handleStartNewChat = (user) => {
        if (!user?._id) return;
        setPrevChats((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            const next = [user, ...arr.filter((u) => String(u?._id) !== String(user?._id))];
            return next;
        });
        dispatch(setSelectedUser(user));
        dispatch(setMessages([]));
        handleCloseComposer();
    };


    const onlineSet = useMemo(() => new Set(Array.isArray(onlineUsers) ? onlineUsers : []), [onlineUsers]);
    const normalizedQuery = useMemo(() => String(query || '').trim().toLowerCase(), [query]);
    const isUnread = (u) => Boolean(u?.unreadCount) || Boolean(u?.hasUnread) || Boolean(u?.unread);

    const following = userData?.following;
    const followingOnline = useMemo(() => {
        const list = Array.isArray(following) ? following : [];
        return list.filter((u) => onlineSet.has(u?._id));
    }, [onlineSet, following]);

    const filteredChats = useMemo(() => {
        const items = Array.isArray(prevChats) ? prevChats : [];
        const byQuery = normalizedQuery
            ? items.filter((u) => {
                const name = String(u?.name || '').toLowerCase();
                const userName = String(u?.userName || '').toLowerCase();
                return name.includes(normalizedQuery) || userName.includes(normalizedQuery);
            })
            : items;

        if (filter === 'online') return byQuery.filter((u) => onlineSet.has(u?._id));
        if (filter === 'unread') return byQuery.filter((u) => isUnread(u));
        return byQuery;
    }, [filter, normalizedQuery, onlineSet, prevChats]);

    const isChatOpen = Boolean(selectedUser?._id);

    const ListPanel = (
        <div className='w-full h-full flex flex-col bg-black relative'>
            {/* Header */}
            <div className='sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-gray-900'>
                <div className='w-full px-[14px] md:px-[18px] pt-[14px] pb-[12px]'>
                    <div className='relative h-[44px] flex items-center'>
                        {mode === 'page' || isChatOpen ? (
                            <button
                                type='button'
                                className='absolute left-0 inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl hover:bg-white/5'
                                onClick={() => (isChatOpen ? handleBackToList() : navigate(`/`))}
                                aria-label='Назад'
                                title='Назад'
                            >
                                <IoChevronBack className='text-white w-[24px] h-[24px]' />
                            </button>
                        ) : null}

                        <div className='absolute left-1/2 -translate-x-1/2 text-white text-[20px] font-semibold leading-tight'>
                            Сообщения
                        </div>

                        <button
                            type='button'
                            className='absolute right-0 inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10'
                            onClick={handleOpenComposer}
                            aria-label='Новый диалог'
                            title='Новый диалог'
                        >
                            <FiEdit3 className='text-white w-[18px] h-[18px]' />
                        </button>
                    </div>

                    <div className='text-gray-500 text-[12px] mt-[2px]'>
                        {isLoading ? 'Загрузка…' : ''}
                    </div>

                    {/* Search */}
                    <div className='mt-[12px] w-full rounded-2xl bg-[#0e1316] border-gray-800 border-2 flex items-center gap-[10px] px-[14px] py-[10px]'>
                        <FiSearch className='text-gray-500 w-[18px] h-[18px] flex-shrink-0' />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder='Поиск по чатам…'
                            className='flex-1 bg-transparent text-white outline-none placeholder:text-gray-500 text-[14px]'
                            autoComplete='off'
                        />
                        {query ? (
                            <button
                                type='button'
                                className='px-[12px] py-[7px] rounded-xl border border-gray-700 bg-black text-white text-[13px] hover:bg-[#353a3d]'
                                onClick={() => setQuery('')}
                            >
                                Очистить
                            </button>
                        ) : null}
                    </div>

                    {/* Filters */}
                    <div ref={filterRef} className='mt-[16px] flex items-center justify-center gap-[8px]'>
                        {FILTERS.map(({ key, label }) => (
                            <button
                                key={key}
                                type='button'
                                data-filter={key}
                                onClick={() => setFilter(key)}
                                className={[
                                    'h-[36px] px-[16px] rounded-full font-semibold text-[13px] whitespace-nowrap transition-all duration-200',
                                    filter === key
                                        ? 'bg-white text-black'
                                        : 'bg-white/8 text-gray-400 hover:bg-white/12 hover:text-white',
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {followingOnline.length ? (
                        <div className='mt-[10px] flex items-center gap-[10px]'>
                            <div className='text-gray-500 text-[12px] font-semibold shrink-0'>Онлайн</div>
                            <div className='flex-1 flex gap-[14px] items-center overflow-x-auto py-[6px]'>
                                {followingOnline.map((user) => (
                                    <OnlineUsers key={user._id} user={user} />
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Conversations */}
            <div className='flex-1 flex flex-col px-[10px] py-[10px] gap-[4px] overflow-y-auto'>
                {loadError ? (
                    <div className='text-red-300 text-[14px] text-center py-[18px]'>{loadError}</div>
                ) : isLoading ? (
                    <div className='flex flex-col gap-[8px] px-[4px] pt-[6px]'>
                        {Array.from({ length: 7 }).map((_, idx) => (
                            <div key={idx} className='flex items-center gap-[14px] px-[14px] py-[12px] rounded-2xl bg-white/5 border border-white/10 animate-pulse'>
                                <div className='w-[52px] h-[52px] rounded-full bg-white/10 flex-shrink-0' />
                                <div className='flex-1 min-w-0'>
                                    <div className='h-[12px] w-[38%] bg-white/10 rounded-md' />
                                    <div className='h-[10px] w-[55%] bg-white/10 rounded-md mt-[8px]' />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div className='px-[12px] pt-[18px]'>
                        <div className='rounded-2xl border border-gray-800 bg-[#0e1316] p-[18px] text-center'>
                            <div className='text-white text-[16px] font-semibold'>
                                {normalizedQuery ? 'Ничего не найдено' : 'Пока нет диалогов'}
                            </div>
                            <div className='text-gray-500 text-[13px] mt-[6px] leading-relaxed'>
                                {normalizedQuery
                                    ? 'Попробуйте изменить запрос или фильтр.'
                                    : 'Начните новый диалог — найдите пользователя и напишите первым.'}
                            </div>
                            <button
                                type='button'
                                className='mt-[14px] inline-flex items-center justify-center gap-[10px] px-[14px] py-[10px] rounded-2xl bg-white text-black text-[13px] font-semibold hover:bg-white/90'
                                onClick={handleOpenComposer}
                            >
                                <FiEdit3 className='w-[16px] h-[16px]' /> Новый диалог
                            </button>
                        </div>
                    </div>
                ) : (
                    filteredChats.map((user) => (
                        <div
                            key={user._id}
                            className='flex items-center gap-[14px] px-[14px] py-[12px] rounded-2xl cursor-pointer hover:bg-gray-900 transition-colors'
                            onClick={() => handleOpenChat(user)}
                        >
                            <div className='w-[52px] h-[52px] rounded-full overflow-hidden flex-shrink-0 border border-gray-800 relative'>
                                <img src={user.profileImage || profile} alt='' className='w-full h-full object-cover' />
                                {onlineSet.has(user?._id) ? (
                                    <div className='absolute bottom-0 right-0 w-[14px] h-[14px] rounded-full bg-black flex items-center justify-center'>
                                        <div className='w-[10px] h-[10px] rounded-full bg-blue-500' />
                                    </div>
                                ) : null}
                            </div>
                            <div className='flex-1 min-w-0'>
                                <div className='text-white font-semibold text-[16px] truncate flex items-center gap-[8px]'>
                                    <span className='truncate'>{user.userName}</span>
                                    {isUnread(user) ? <span className='shrink-0 w-[8px] h-[8px] rounded-full bg-white' /> : null}
                                </div>
                                <div className='text-gray-400 text-[13px] truncate'>{user.name}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New dialog overlay */}
            {isComposerOpen ? (
                <div className='absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex'>
                    <div className='w-full h-full bg-black border-l border-gray-900'>
                        <div className='sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-gray-900 px-[14px] md:px-[18px] pt-[14px] pb-[12px]'>
                            <div className='relative h-[44px] flex items-center'>
                                <button
                                    type='button'
                                    className='absolute left-0 inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl hover:bg-white/5'
                                    onClick={handleCloseComposer}
                                    aria-label='Закрыть'
                                    title='Закрыть'
                                >
                                    <IoChevronBack className='text-white w-[24px] h-[24px]' />
                                </button>
                                <div className='absolute left-1/2 -translate-x-1/2 text-white text-[18px] font-semibold leading-tight'>
                                    Новый диалог
                                </div>
                            </div>

                            <div className='mt-[12px] w-full rounded-2xl bg-[#0e1316] border-gray-800 border-2 flex items-center gap-[10px] px-[14px] py-[10px]'>
                                <FiSearch className='text-gray-500 w-[18px] h-[18px] flex-shrink-0' />
                                <input
                                    value={composerQuery}
                                    onChange={(e) => setComposerQuery(e.target.value)}
                                    placeholder='Введите имя или username…'
                                    className='flex-1 bg-transparent text-white outline-none placeholder:text-gray-500 text-[14px]'
                                    autoComplete='off'
                                />
                                {composerQuery ? (
                                    <button
                                        type='button'
                                        className='px-[12px] py-[7px] rounded-xl border border-gray-700 bg-black text-white text-[13px] hover:bg-[#353a3d]'
                                        onClick={() => setComposerQuery('')}
                                    >
                                        Очистить
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className='p-[10px] overflow-y-auto h-[calc(100%-86px)]'>
                            {composerQuery.trim().length < 2 ? (
                                <div className='text-gray-500 text-[14px] text-center py-[26px]'>Введите минимум 2 символа</div>
                            ) : composerError ? (
                                <div className='text-red-300 text-[14px] text-center py-[18px]'>{composerError}</div>
                            ) : composerLoading ? (
                                <div className='text-gray-300 text-[14px] text-center py-[18px]'>Идёт поиск…</div>
                            ) : composerResults.length === 0 ? (
                                <div className='text-gray-500 text-[14px] text-center py-[18px]'>Ничего не найдено</div>
                            ) : (
                                <div className='flex flex-col gap-[4px]'>
                                    {composerResults.map((u) => (
                                        <button
                                            key={u?._id || u?.userName}
                                            type='button'
                                            className='w-full text-left flex items-center gap-[12px] px-[12px] py-[10px] rounded-2xl hover:bg-gray-900 transition-colors'
                                            onClick={() => handleStartNewChat(u)}
                                        >
                                            <div className='w-[44px] h-[44px] rounded-full overflow-hidden border border-gray-800 flex-shrink-0'>
                                                <img src={u?.profileImage || profile} alt='' className='w-full h-full object-cover' />
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <div className='text-white text-[14px] font-semibold truncate'>{u?.userName}</div>
                                                <div className='text-gray-500 text-[12px] truncate'>{u?.name}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );

    if (mode === 'sidebar') {
        return (
            <div className='w-full h-full min-h-[100vh] bg-black'>
                {ListPanel}
            </div>
        )
    }

    return (
        <div className='w-full h-[100vh] bg-black overflow-hidden'>
            {/* Mobile: slide animation between list and chat */}
            <div
                className='w-full h-full flex lg:hidden transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'
                style={{ transform: isChatOpen ? 'translateX(-100%)' : 'translateX(0%)' }}
            >
                <div className='w-full h-full flex-shrink-0'>
                    {ListPanel}
                </div>
                <div className='w-full h-full flex-shrink-0'>
                    <ChatPane showBack={true} onBack={handleBackToList} />
                </div>
            </div>

            {/* Desktop: animated master-detail */}
            <div className='hidden lg:flex w-full h-full'>
                <div
                    className='h-full border-r border-gray-900 transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'
                    style={{ width: isChatOpen ? 360 : '100%' }}
                >
                    {ListPanel}
                </div>
                <div
                    className='h-full overflow-hidden transition-[width,opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'
                    style={{
                        width: isChatOpen ? 'calc(100% - 360px)' : 0,
                        opacity: isChatOpen ? 1 : 0,
                        transform: isChatOpen ? 'translateX(0px)' : 'translateX(24px)',
                        pointerEvents: isChatOpen ? 'auto' : 'none',
                    }}
                >
                    <ChatPane showBack={true} onBack={handleBackToList} />
                </div>
            </div>
        </div>
    );
}

export default Messages;
