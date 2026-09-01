import React, { useState } from "react";
import { ClipLoader } from "react-spinners";
import { serverURL } from "../config/serverUrl";
import axios from "axios";

function ForgotPassword() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [err, setError] = useState("");

    const [inputClicked, setInputClicked] = useState({
        email: false,
        otp: false,
        newPassword: false,
        confirmNewPassword: false
    });

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");

    // ШАГ 1: Отправка OTP
    const handleStep1 = async () => {
        setLoading(true);
        setError("");
        try {
            const result = await axios.post(`${serverURL}/api/auth/sendOtp`, { email }, { withCredentials: true });
            console.log(result.data);
            setStep(2);
            setLoading(false);
        } catch (error) {
            console.log(error);
            setLoading(false);
            // Берем сообщение из error.response, если оно есть, иначе стандартный текст
            const errorMessage = error.response?.data?.message || "Пользователь с таким email не найден";
            setError(errorMessage);
        }
    };

    // ШАГ 2: Проверка OTP
    const handleStep2 = async () => {
        setLoading(true);
        setError("");
        try {
            const result = await axios.post(`${serverURL}/api/auth/verifyOtp`, { email, otp }, { withCredentials: true });
            console.log(result.data);
            setStep(3);
            setLoading(false);
        } catch (error) {
            console.log(error);
            setLoading(false);
            const errorMessage = error.response?.data?.message || "Неверный или просроченный код";
            setError(errorMessage);
        }
    };

    // ШАГ 3: Установка нового пароля
    const handleStep3 = async () => {
        if (newPassword !== confirmNewPassword) {
            return setError("Пароли не совпадают");
        }
        setError("");
        setLoading(true)
        try {
            const result = await axios.post(`${serverURL}/api/auth/resetPassword`, { email, password: newPassword }, { withCredentials: true });
            console.log(result.data);
            alert("Пароль успешно изменен!");
            setLoading(false);
            
        } catch (error) {
            console.log(error);
            setLoading(false);
            const errorMessage = error.response?.data?.message || "Ошибка при смене пароля";
            setError(errorMessage);
        }
    };

    return (
        <div className="w-full h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col justify-center items-center">
            
            {/* Step 1: Ввод Email */}
            {step === 1 && (
                <div className="w-[90%] max-w-[500px] h-[500px] bg-white rounded-2xl flex justify-center items-center flex-col border-[#1a1f23] p-6">
                    <h2 className="text-[30px] font-semibold mb-2">Забыли пароль?</h2>
                    <div className='relative flex items-center mt-[30px] justify-start w-full h-[50px] rounded-2xl border-2 border-black'
                        onClick={() => setInputClicked({ ...inputClicked, email: true })}>
                        <label htmlFor="email" className={`text-gray-700 absolute left-[20px] p-[5px] bg-white text-[15px] transition-all ${inputClicked.email || email ? "top-[-15px] text-[12px]" : ""}`}>
                            Введите свой Email
                        </label>
                        <input type="email" id="email" className='w-full h-full rounded-2xl px-[20px] outline-none border-0'
                            required onChange={(e) => setEmail(e.target.value)} value={email} />
                    </div>

                    {err && <p className="text-red-500 mt-4 text-sm font-medium">{err}</p>}

                    <button className='w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl mt-[30px] flex justify-center items-center'
                        disabled={loading} onClick={handleStep1}>
                        {loading ? <ClipLoader size={25} color="white" /> : 'Отправить код'}
                    </button>
                </div>
            )}

            {/* Step 2: Ввод OTP */}
            {step === 2 && (
                <div className="w-[90%] max-w-[500px] h-[500px] bg-white rounded-2xl flex justify-center items-center flex-col border-[#1a1f23] p-6">
                    <h2 className="text-[30px] font-semibold mb-2">Введите код</h2>
                    <p className="text-gray-500 mb-4 text-center">Код отправлен на {email}</p>
                    <div className='relative flex items-center mt-[20px] justify-start w-full h-[50px] rounded-2xl border-2 border-black'
                        onClick={() => setInputClicked({ ...inputClicked, otp: true })}>
                        <label htmlFor="otp" className={`text-gray-700 absolute left-[20px] p-[5px] bg-white text-[15px] transition-all ${inputClicked.otp || otp ? "top-[-15px] text-[12px]" : ""}`}>
                            Код из письма
                        </label>
                        <input type="text" id="otp" className='w-full h-full rounded-2xl px-[20px] outline-none border-0'
                            required onChange={(e) => setOtp(e.target.value)} value={otp} />
                    </div>

                    {err && <p className="text-red-500 mt-4 text-sm font-medium">{err}</p>}

                    <button className='w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl mt-[30px] flex justify-center items-center'
                        disabled={loading} onClick={handleStep2}>
                        {loading ? <ClipLoader size={25} color="white" /> : 'Подтвердить код'}
                    </button>
                </div>
            )}

            {/* Step 3: Новый пароль */}
            {step === 3 && (
                <div className="w-[90%] max-w-[500px] h-[500px] bg-white rounded-2xl flex justify-center items-center flex-col border-[#1a1f23] p-6">
                    <h2 className="text-[30px] font-semibold mb-2 text-center">Новый пароль</h2>
                    
                    <div className='relative flex items-center mt-[30px] justify-start w-full h-[50px] rounded-2xl border-2 border-black'
                        onClick={() => setInputClicked({ ...inputClicked, newPassword: true })}>
                        <label htmlFor="newPassword" className={`text-gray-700 absolute left-[20px] p-[5px] bg-white text-[15px] transition-all ${inputClicked.newPassword || newPassword ? "top-[-15px] text-[12px]" : ""}`}>
                            Новый пароль
                        </label>
                        <input type="password" id="newPassword" className='w-full h-full rounded-2xl px-[20px] outline-none border-0'
                            required onChange={(e) => setNewPassword(e.target.value)} value={newPassword} />
                    </div>

                    <div className='relative flex items-center mt-[30px] justify-start w-full h-[50px] rounded-2xl border-2 border-black'
                        onClick={() => setInputClicked({ ...inputClicked, confirmNewPassword: true })}>
                        <label htmlFor="confirmNewPassword" className={`text-gray-700 absolute left-[20px] p-[5px] bg-white text-[15px] transition-all ${inputClicked.confirmNewPassword || confirmNewPassword ? "top-[-15px] text-[12px]" : ""}`}>
                            Повторите пароль
                        </label>
                        <input type="password" id="confirmNewPassword" className='w-full h-full rounded-2xl px-[20px] outline-none border-0'
                            required onChange={(e) => setConfirmNewPassword(e.target.value)} value={confirmNewPassword} />
                    </div>

                    {err && <p className="text-red-500 mt-4 text-sm font-medium">{err}</p>}

                    <button className='w-[70%] px-[20px] py-[10px] bg-black text-white font-semibold h-[50px] cursor-pointer rounded-2xl mt-[30px] flex justify-center items-center'
                        disabled={loading} onClick={handleStep3}>
                        {loading ? <ClipLoader size={25} color="white" /> : 'Сбросить пароль'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default ForgotPassword;