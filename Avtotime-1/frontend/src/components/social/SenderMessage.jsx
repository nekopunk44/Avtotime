import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import profile from '../../assets/profile.png';

const formatBytes = (bytes) => {
    const size = Number(bytes || 0);
    if (!size) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
    const value = size / Math.pow(1024, idx);
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};


function SenderMessage({ message }) {
    const { userData } = useSelector(state => state.user);
    const scroll = useRef(null);

    useEffect(() => {
        if (scroll.current) {
            scroll.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [message.message, message.image, message.file]);

    return (
        <div ref={scroll} className='relative ml-auto mb-3 flex flex-col items-end'>
            <div className='w-fit max-w-full bg-gradient-to-br from-[#9500ff] to-[#ff0095] 
                           rounded-t-2xl rounded-bl-2xl p-2 flex flex-col gap-2'>
                {message.image && (
                    <img 
                        src={message.image} 
                        className='w-[240px] h-[180px] sm:w-[300px] sm:h-[220px] object-cover rounded-xl block' 
                    />
                )}
                {message.file && (
                    <a
                        href={message.file}
                        target='_blank'
                        rel='noreferrer'
                        className='w-[240px] sm:w-[300px] rounded-xl bg-black/25 border border-white/20 px-3 py-2 hover:bg-black/35 transition-colors'
                    >
                        <div className='text-white text-[13px] font-semibold truncate'>{message.fileName || 'Файл'}</div>
                        <div className='text-white/70 text-[12px] mt-[2px]'>
                            {[message.fileType, formatBytes(message.fileSize)].filter(Boolean).join(' • ')}
                        </div>
                    </a>
                )}
                {message.audioUrl && (
                    <audio controls src={message.audioUrl} className='max-w-[260px] h-[36px]' />
                )}
                {message.message && (
                    <div className='px-2 text-[16px] text-white break-words'>{message.message}</div>
                )}
            </div>
            
            {/* Аватарка справа */}
            <div className='w-[30px] h-[30px] rounded-full border-2 border-black overflow-hidden
                            absolute right-[-38px] bottom-0 bg-gray-800'>
                <img src={userData?.profileImage || profile} className='w-full h-full object-cover' />
            </div>
        </div>
    );
}


export default SenderMessage
