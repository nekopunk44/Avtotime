import React, { useState } from 'react'
import axios from 'axios'
import { serverURL } from '../../config/serverUrl'

// Mirrors REPORT_REASONS in backend/models/report.model.js: stable keys travel
// to the API, labels stay a client concern.
const REASONS = [
    { key: 'spam', label: 'Спам' },
    { key: 'harassment', label: 'Оскорбления или травля' },
    { key: 'hate', label: 'Разжигание ненависти' },
    { key: 'violence', label: 'Насилие или опасные действия' },
    { key: 'sexual', label: 'Откровенный контент' },
    { key: 'scam', label: 'Мошенничество' },
    { key: 'illegal', label: 'Незаконные товары или действия' },
    { key: 'misinformation', label: 'Дезинформация' },
    { key: 'copyright', label: 'Нарушение авторских прав' },
    { key: 'other', label: 'Другое' },
]

/**
 * Жалоба на пост, комментарий, пользователя или объявление.
 *
 * targetType: post | loop | comment | user | listing
 * targetKind: для listing — ключ раздела маркета (cars, parts, …)
 */
function ReportDialog({ targetType, targetId, targetKind = '', onClose }) {
    const [reason, setReason] = useState(null)
    const [comment, setComment] = useState('')
    const [status, setStatus] = useState('idle') // idle | sending | done | already | error
    const [errorText, setErrorText] = useState('')

    const submit = async () => {
        if (!reason || status === 'sending') return
        setStatus('sending')
        try {
            await axios.post(
                `${serverURL}/api/reports`,
                { targetType, targetId, targetKind, reason, comment: comment.trim() },
                { withCredentials: true },
            )
            setStatus('done')
        } catch (error) {
            if (error?.response?.status === 409) {
                setStatus('already')
            } else {
                setErrorText(error?.response?.data?.message || 'Не удалось отправить жалобу')
                setStatus('error')
            }
        }
    }

    const finished = status === 'done' || status === 'already'

    return (
        <div
            className='fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4'
            onClick={onClose}
        >
            <div
                className='w-full max-w-[420px] bg-white rounded-[24px] shadow-2xl overflow-hidden'
                onClick={(e) => e.stopPropagation()}
            >
                <div className='px-5 pt-5 pb-3'>
                    <div className='text-[17px] font-bold'>
                        {finished ? 'Жалоба отправлена' : 'Пожаловаться'}
                    </div>
                    {!finished && (
                        <div className='text-[13px] text-gray-500 mt-1'>
                            Что именно не так? Жалоба анонимна для автора.
                        </div>
                    )}
                </div>

                {finished ? (
                    <div className='px-5 pb-5'>
                        <div className='text-[14px] text-gray-700'>
                            {status === 'already'
                                ? 'Вы уже жаловались на этот объект — жалоба на рассмотрении.'
                                : 'Спасибо. Модераторы рассмотрят её в течение суток, результат придёт в уведомления.'}
                        </div>
                        <button
                            className='mt-4 w-full py-3 bg-black text-white rounded-xl text-[14px] font-semibold'
                            onClick={onClose}
                        >
                            Понятно
                        </button>
                    </div>
                ) : (
                    <>
                        <div className='max-h-[300px] overflow-y-auto'>
                            {REASONS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    className={`w-full px-5 py-3 text-left text-[14px] transition-colors flex items-center justify-between ${
                                        reason === key ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => setReason(key)}
                                >
                                    <span>{label}</span>
                                    {reason === key && <span className='text-black'>✓</span>}
                                </button>
                            ))}
                        </div>

                        <div className='px-5 pt-3'>
                            <textarea
                                className='w-full border border-gray-200 rounded-xl p-3 text-[13px] resize-none focus:outline-none focus:border-gray-400'
                                rows={2}
                                maxLength={1000}
                                placeholder='Комментарий (необязательно)'
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>

                        {status === 'error' && (
                            <div className='px-5 pt-1 text-[13px] text-red-500'>{errorText}</div>
                        )}

                        <div className='px-5 py-4 flex gap-2'>
                            <button
                                className='flex-1 py-3 border border-gray-200 rounded-xl text-[14px] font-medium hover:bg-gray-50 transition-colors'
                                onClick={onClose}
                            >
                                Отмена
                            </button>
                            <button
                                className='flex-1 py-3 bg-black text-white rounded-xl text-[14px] font-semibold disabled:opacity-40 transition-opacity'
                                disabled={!reason || status === 'sending'}
                                onClick={submit}
                            >
                                {status === 'sending' ? 'Отправка…' : 'Отправить'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default ReportDialog
