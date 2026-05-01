import React, { useEffect, useRef, useState } from 'react'; 
import { FiVolume2, FiVolumeX } from "react-icons/fi";

function VideoPlayer({ media }) {
    const videoTag = useRef(null);
    const [mute, setMute] = useState(true);
    const [isPlaying, setIsPlaying] = useState(true);

    const handleClick = () => {
        const video = videoTag.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
            setIsPlaying(false);
        } else {
            video.play();
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0]; 
            const video = videoTag.current;
            if (!video) return;

            if (entry.isIntersecting) {
               
                video.play().catch(err => console.log("Автоплей заблокирован:", err));
                setIsPlaying(true);
            } else {
                video.pause();
                setIsPlaying(false);
            }
        }, { threshold: 0.6 });

        if (videoTag.current) {
            observer.observe(videoTag.current);
        }

        return () => {
            if (videoTag.current) {
                observer.unobserve(videoTag.current);
            }
        };
    }, []);

    return (
        <div className='h-full relative cursor-pointer max-w-full rounded-2xl overflow-hidden bg-black flex items-center'>
            <video 
                ref={videoTag} 
                src={media} 
                autoPlay 
                loop 
                playsInline 
                muted={mute}
                className='h-full cursor-pointer w-full object-contain rounded-2xl'
                onClick={handleClick}
            />

            <div 
                className='absolute bottom-[10px] right-[10px] bg-black/50 p-2 rounded-full' 
                onClick={(e) => {
                    e.stopPropagation(); // Чтобы не срабатывал клик по видео (пауза)
                    setMute(prev => !prev);
                }}
            >
                {mute ? (
                    <FiVolumeX className='w-[20px] h-[20px] text-white' />
                ) : (
                    <FiVolume2 className='w-[20px] h-[20px] text-white' />
                )}
            </div>
        </div>
    );
}

export default VideoPlayer;