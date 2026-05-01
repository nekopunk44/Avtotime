import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MdOutlineKeyboardBackspace } from "react-icons/md";
import { LuPaperclip } from "react-icons/lu";
import { IoMdSend } from "react-icons/io";
import { FiSearch } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import SenderMessage from '../components/social/SenderMessage';
import ReceiverMessage from '../components/social/ReceiverMessage';
import profile from '../assets/profile.png';
import { serverURL } from '../App';
import { setMessages, setSelectedUser } from '../redux/messageSlice';

const DEFAULT_MESSAGES_LIMIT = 50;

function MessagesArea() {
    const { selectedUser, messages } = useSelector(state => state.message);
    const { userData } = useSelector(state => state.user);
    const { onlineUsers } = useSelector((state) => state.socket);

    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [input, setInput] = useState('');
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [prevChats, setPrevChats] = useState([]);
    const [isChatsLoading, setIsChatsLoading] = useState(true);
    const [chatsError, setChatsError] = useState('');
    const [chatsQuery, setChatsQuery] = useState('');

    const imageInput = useRef();
    const scrollContainerRef = useRef();

    const onlineSet = useMemo(() => new Set(Array.isArray(onlineUsers) ? onlineUsers : []), [onlineUsers]);
    const normalizedChatsQuery = useMemo(() => String(chatsQuery || '').trim().toLowerCase(), [chatsQuery]);

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            container.scrollTo({
                top: container.scrollHeight,
                behavior: messages?.length <= 1 ? "auto" : "smooth" 
            });
        }
    };

    useEffect(() => {
        const fetchPrevChats = async () => {
            try {
                setIsChatsLoading(true);
                setChatsError('');
                const result = await axios.get(`${serverURL}/api/message/prevChats/?limit=50`, { withCredentials: true });
                setPrevChats(Array.isArray(result.data) ? result.data : []);
            } catch (error) {
                console.log(error);
                setChatsError('Не удалось загрузить диалоги');
            } finally {
                setIsChatsLoading(false);
            }
        };

        fetchPrevChats();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToBottom();
        }, 100);
        return () => clearTimeout(timer);
    }, [messages]);

    const handleAttachment = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAttachmentFile(file);
        if (typeof file.type === 'string' && file.type.startsWith('image/')) {
            setAttachmentPreview(URL.createObjectURL(file));
        } else {
            setAttachmentPreview(null);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!selectedUser?._id) return;
        if (!input && !attachmentFile) return;

        try {
            const formData = new FormData();
            formData.append('message', input);
            if (attachmentFile) {
                const isImage = typeof attachmentFile.type === 'string' && attachmentFile.type.startsWith('image/');
                formData.append(isImage ? 'image' : 'file', attachmentFile);
            }

            const result = await axios.post(
                `${serverURL}/api/message/send/${selectedUser?._id}`,
                formData,
                {
                    withCredentials: true,
                    headers: { 'Content-Type': 'multipart/form-data' }
                }
            );
            
            dispatch(setMessages([...messages, result.data]));
            setInput('');
            setAttachmentPreview(null);
            setAttachmentFile(null);
            imageInput.current.value = null;

            setPrevChats((prev) => {
                const arr = Array.isArray(prev) ? prev : [];
                const exists = arr.find((u) => String(u?._id) === String(selectedUser?._id));
                const next = exists ? [exists, ...arr.filter((u) => String(u?._id) !== String(selectedUser?._id))] : arr;
                return next;
            });
        } catch (error) {
            console.log(error);
        }
    };

    const getAllMessages = async () => {
        try {
            const result = await axios.get(
                `${serverURL}/api/message/getAll/${selectedUser?._id}?page=1&limit=${DEFAULT_MESSAGES_LIMIT}`,
                { withCredentials: true }
            );
            dispatch(setMessages(result.data));
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (selectedUser?._id) {
            getAllMessages();
        }
    }, [selectedUser]);

    const filteredChats = useMemo(() => {
        const items = Array.isArray(prevChats) ? prevChats : [];
        if (!normalizedChatsQuery) return items;
        return items.filter((u) => {
            const name = String(u?.name || '').toLowerCase();
            const userName = String(u?.userName || '').toLowerCase();
            return name.includes(normalizedChatsQuery) || userName.includes(normalizedChatsQuery);
        });
    }, [normalizedChatsQuery, prevChats]);

    useEffect(() => {
        if (!selectedUser?._id) {
            navigate('/messages');
        }
    }, [navigate, selectedUser?._id]);

    const handleSelectChat = (user) => {
        if (!user?._id) return;
        dispatch(setSelectedUser(user));
        dispatch(setMessages([]));
        setInput('');
        setAttachmentPreview(null);
        setAttachmentFile(null);
        if (imageInput.current) imageInput.current.value = null;
    };

    return (
        <div className="w-full h-screen bg-black flex overflow-hidden">
            {/* LEFT: CHATS LIST (desktop) */}
            <aside className="hidden lg:flex w-[340px] border-r border-gray-900 bg-black flex-col">
                <div className="flex-none sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-gray-900 px-[14px] py-[14px]">
                    <div className="flex items-center gap-[10px]">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-xl hover:bg-white/5"
                            onClick={() => navigate('/')}
                            aria-label="Назад"
                            title="Назад"
                        >
                            <MdOutlineKeyboardBackspace className="text-white w-5 h-5" />
                        </button>
                        <div className="text-white text-[18px] font-semibold">Диалоги</div>
                    </div>

                    <div className="mt-[10px] w-full rounded-2xl bg-[#0e1316] border-gray-800 border-2 flex items-center gap-[10px] px-[12px] py-[10px]">
                        <FiSearch className="text-gray-500 w-[16px] h-[16px] flex-shrink-0" />
                        <input
                            value={chatsQuery}
                            onChange={(e) => setChatsQuery(e.target.value)}
                            placeholder="Поиск…"
                            className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-500 text-[14px]"
                            autoComplete="off"
                        />
                        {chatsQuery ? (
                            <button
                                type="button"
                                className="px-[10px] py-[6px] rounded-xl border border-gray-700 bg-black text-white text-[12px] hover:bg-[#353a3d]"
                                onClick={() => setChatsQuery('')}
                            >
                                Очистить
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-[10px]">
                    {chatsError ? (
                        <div className="text-red-300 text-[13px] text-center py-[14px]">{chatsError}</div>
                    ) : isChatsLoading ? (
                        <div className="flex flex-col gap-[8px] pt-[6px]">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="flex items-center gap-[12px] px-[12px] py-[10px] rounded-2xl bg-white/5 border border-white/10 animate-pulse">
                                    <div className="w-[44px] h-[44px] rounded-full bg-white/10 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="h-[11px] w-[48%] bg-white/10 rounded-md" />
                                        <div className="h-[9px] w-[62%] bg-white/10 rounded-md mt-[7px]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-gray-500 text-[13px] text-center py-[14px]">
                            {normalizedChatsQuery ? 'Ничего не найдено' : 'Нет диалогов'}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-[4px]">
                            {filteredChats.map((user) => {
                                const isActive = String(user?._id) === String(selectedUser?._id);
                                return (
                                    <button
                                        key={user._id}
                                        type="button"
                                        className={[
                                            'w-full text-left flex items-center gap-[12px] px-[12px] py-[10px] rounded-2xl transition-colors',
                                            isActive ? 'bg-white/10' : 'hover:bg-gray-900',
                                        ].join(' ')}
                                        onClick={() => handleSelectChat(user)}
                                    >
                                        <div className="w-[44px] h-[44px] rounded-full overflow-hidden border border-gray-800 flex-shrink-0 relative">
                                            <img src={user?.profileImage || profile} alt="" className="w-full h-full object-cover" />
                                            {onlineSet.has(user?._id) ? (
                                                <div className="absolute bottom-0 right-0 w-[12px] h-[12px] rounded-full bg-black flex items-center justify-center">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-blue-500" />
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white text-[14px] font-semibold truncate">{user?.userName}</div>
                                            <div className="text-gray-500 text-[12px] truncate">{user?.name}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>

            {/* RIGHT: CHAT */}
            <div className="flex-1 relative flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="flex-none w-full flex items-center gap-4 px-5 h-[80px] bg-black border-b border-gray-900">
                    <button
                        type="button"
                        className="lg:hidden inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl hover:bg-white/5"
                        onClick={() => navigate('/messages')}
                        aria-label="Назад"
                        title="Назад"
                    >
                        <MdOutlineKeyboardBackspace className="text-white w-6 h-6" />
                    </button>
                    <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer relative">
                        <img
                            src={selectedUser?.profileImage || profile}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                        {onlineSet.has(selectedUser?._id) ? (
                            <div className="absolute -bottom-[2px] -right-[2px] w-[14px] h-[14px] rounded-full bg-black flex items-center justify-center">
                                <div className="w-[10px] h-[10px] rounded-full bg-blue-500" />
                            </div>
                        ) : null}
                    </div>
                    <div className="text-white min-w-0">
                        <div className="text-lg font-semibold truncate">{selectedUser?.userName}</div>
                        <div className="text-sm text-gray-400 truncate">{selectedUser?.name}</div>
                    </div>
                </div>

                {/* MESSAGES CONTAINER */}
                <div
                    ref={scrollContainerRef}
                    className="flex-grow w-full px-4 sm:px-10 lg:px-12 overflow-y-auto flex flex-col gap-6 bg-black py-5"
                >
                    {messages && messages.map((mess) =>
                        mess.sender === userData?._id ? (
                            <SenderMessage key={mess._id} message={mess} />
                        ) : (
                            <ReceiverMessage key={mess._id} message={mess} />
                        )
                    )}
                    <div className="min-h-[20px] w-full"></div>
                </div>

                {/* INPUT AREA */}
                <div className="flex-none w-full h-[100px] bg-black flex justify-center items-center p-4">
                    <form
                        onSubmit={handleSendMessage}
                        className="w-full max-w-[800px] h-[60px] rounded-full bg-[#1a1a1a] border border-gray-800 flex items-center gap-3 px-5 relative"
                    >
                        {attachmentPreview ? (
                            <div className="absolute -top-[120px] right-4 w-[100px] h-[100px] rounded-xl overflow-hidden border-2 border-purple-600">
                                <img src={attachmentPreview} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : null}
                        {attachmentFile && !attachmentPreview ? (
                            <div className="absolute -top-[74px] right-4 max-w-[260px] rounded-2xl border border-gray-800 bg-[#0e1316] px-4 py-3 text-[13px] text-gray-200">
                                <div className="font-semibold text-white truncate">{attachmentFile?.name || 'Файл'}</div>
                                <div className="text-gray-500 text-[12px] mt-[2px]">Файл будет отправлен вместе с сообщением</div>
                            </div>
                        ) : null}
                        <input type="file" hidden ref={imageInput} onChange={handleAttachment} />
                        <input
                            type="text"
                            placeholder="Сообщение"
                            className="w-full h-full bg-transparent outline-none text-white text-lg px-2 disabled:text-gray-500"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={!selectedUser?._id}
                        />
                        <LuPaperclip
                            className={['w-7 h-7 cursor-pointer', selectedUser?._id ? 'text-white hover:text-purple-500' : 'text-gray-600 cursor-not-allowed'].join(' ')}
                            onClick={() => (selectedUser?._id ? imageInput.current.click() : null)}
                        />
                        {(selectedUser?._id && (input || attachmentFile)) && (
                            <button type="submit" className="w-[45px] h-[45px] rounded-full bg-gradient-to-br from-[#9500ff] to-[#ff0095] flex items-center justify-center shrink-0">
                                <IoMdSend className="text-white w-5 h-5" />
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}

export default MessagesArea;
