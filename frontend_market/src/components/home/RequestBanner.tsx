import React, { useState } from 'react';
import { API_URL } from '../../utils/config';

type RequestBannerProps = {
  onSuccessNotification?: () => void;
};

export const RequestBanner: React.FC<RequestBannerProps> = ({ onSuccessNotification }) => {
  const [formData, setFormData] = useState({
    marca: '',
    model: '',
    year: '',
    email: '',
    region: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { placeholder, value } = e.target;
    const fieldMap: { [key: string]: keyof typeof formData } = {
      'марка': 'marca',
      'модель': 'model',
      'год': 'year',
      'email': 'email',
      'регион': 'region'
    };
    
    const fieldName = fieldMap[placeholder];
    if (fieldName) {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Валидация
    if (!formData.marca || !formData.model || !formData.year || !formData.email || !formData.region) {
      setMessage('Пожалуйста, заполните все поля');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/car-request/send-car-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        // Сообщение об успехе показываем в разделе уведомлений, не здесь.
        setMessage('');
        // Очистить форму
        setFormData({
          marca: '',
          model: '',
          year: '',
          email: '',
          region: ''
        });
        onSuccessNotification?.();
      } else {
        setMessage(data.message || 'Ошибка при отправке заявки');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      setMessage('Ошибка при отправке заявки. Попробуйте позже.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
      // Скрыть сообщение через 5 секунд
      setTimeout(() => setMessage(''), 5000);
    }
  };
  return (
    <section className="pb-0 w-full">
      <div className="relative h-[600px] overflow-hidden flex flex-col justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/predfoot.png" 
            alt="Porsche in snow" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {/* Removed darkening overlay */}
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-20 lg:px-24">
            <h2 className="text-white text-[24px] sm:text-[32px] md:text-[38px] lg:text-[44px] font-bold leading-[1.1] mb-12 text-left tracking-tight max-w-fit mx-auto">
              Если нужного автомобиля пока нет на нашем сайте,<br className="hidden lg:block" />
              оставьте заявку — и мы уведомим вас рассылкой сразу<br className="hidden lg:block" />
              после его появления.
            </h2>

            {/* Form */}
            <div className="max-w-fit mx-auto">
              <form onSubmit={handleSubmit}>
                {/* Desktop view: single row */}
                <div className="hidden lg:flex flex-nowrap gap-3 justify-center items-center">
                  <div className="flex-shrink-0 w-[140px]">
                    <input 
                      type="text" 
                      placeholder="марка" 
                      value={formData.marca}
                      onChange={handleChange}
                      className="w-full h-11 px-6 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[15px] font-medium focus:outline-none transition-all text-center"
                    />
                  </div>
                  <div className="flex-shrink-0 w-[160px]">
                    <input 
                      type="text" 
                      placeholder="модель" 
                      value={formData.model}
                      onChange={handleChange}
                      className="w-full h-11 px-6 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[15px] font-medium focus:outline-none transition-all text-center"
                    />
                  </div>
                  <div className="flex-shrink-0 w-[80px]">
                    <input 
                      type="text" 
                      placeholder="год" 
                      value={formData.year}
                      onChange={handleChange}
                      className="w-full h-11 px-6 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[15px] font-medium focus:outline-none transition-all text-center"
                    />
                  </div>
                  <div className="flex-shrink-0 w-[320px]">
                    <input 
                      type="email" 
                      placeholder="email" 
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full h-11 px-6 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[15px] font-medium focus:outline-none transition-all text-center"
                    />
                  </div>
                  <div className="flex-shrink-0 w-[120px]">
                    <input 
                      type="text" 
                      placeholder="регион" 
                      value={formData.region}
                      onChange={handleChange}
                      className="w-full h-11 px-6 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[15px] font-medium focus:outline-none transition-all text-center"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex-shrink-0 h-11 px-12 rounded-full bg-[#1E1364] text-white text-[15px] font-bold hover:bg-[#160d4d] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    {isLoading ? 'отправка...' : 'отправить'}
                  </button>
                </div>

                {/* Tablet and Mobile view: 3 rows */}
                <div className="lg:hidden flex flex-col gap-4 w-full max-w-2xl">
                  {/* Row 1: марка, модель, год */}
                  <div className="flex gap-3 w-full">
                    <div className="flex-[1.2] min-w-0">
                      <input 
                        type="text" 
                        placeholder="марка" 
                        value={formData.marca}
                        onChange={handleChange}
                        className="w-full h-11 px-4 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[14px] font-medium focus:outline-none transition-all text-center"
                      />
                    </div>
                    <div className="flex-[1.5] min-w-0">
                      <input 
                        type="text" 
                        placeholder="модель" 
                        value={formData.model}
                        onChange={handleChange}
                        className="w-full h-11 px-4 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[14px] font-medium focus:outline-none transition-all text-center"
                      />
                    </div>
                    <div className="w-[80px] flex-shrink-0">
                      <input 
                        type="text" 
                        placeholder="год" 
                        value={formData.year}
                        onChange={handleChange}
                        className="w-full h-11 px-2 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[14px] font-medium focus:outline-none transition-all text-center"
                      />
                    </div>
                  </div>
                  {/* Row 2: email, регион */}
                  <div className="flex gap-3 w-full">
                    <div className="flex-[2] min-w-0">
                      <input 
                        type="email" 
                        placeholder="email" 
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full h-11 px-4 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[14px] font-medium focus:outline-none transition-all text-center"
                      />
                    </div>
                    <div className="flex-[1] min-w-0">
                      <input 
                        type="text" 
                        placeholder="регион" 
                        value={formData.region}
                        onChange={handleChange}
                        className="w-full h-11 px-4 rounded-full bg-white/40 backdrop-blur-md border border-black/30 text-black placeholder:text-black/80 text-[14px] font-medium focus:outline-none transition-all text-center"
                      />
                    </div>
                  </div>
                  {/* Row 3: отправить */}
                  <div className="flex w-full justify-center">
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full sm:w-auto h-11 px-12 rounded-full bg-[#1E1364] text-white text-[15px] font-bold hover:bg-[#160d4d] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {isLoading ? 'отправка...' : 'отправить'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Сообщение об ошибке */}
              {message && messageType === 'error' && (
                <div className="mt-4 text-center px-4 py-3 rounded-lg font-medium text-[14px] bg-red-500/80 text-white">
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
