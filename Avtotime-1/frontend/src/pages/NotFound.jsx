import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-[96px] font-black text-gray-900 leading-none">404</div>
      <div className="mt-4 text-[22px] font-black text-gray-900">Страница не найдена</div>
      <div className="mt-2 text-[14px] text-gray-500 max-w-[320px]">
        Такой страницы не существует или она была удалена.
      </div>
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-2xl border border-gray-200 px-5 py-2.5 text-[14px] font-bold text-gray-700 hover:bg-gray-50"
        >
          Назад
        </button>
        <button
          onClick={() => navigate("/")}
          className="rounded-2xl bg-black px-5 py-2.5 text-[14px] font-bold text-white hover:bg-gray-900"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
