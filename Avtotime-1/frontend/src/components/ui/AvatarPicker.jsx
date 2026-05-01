import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaCamera, FaTrash } from "react-icons/fa";

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** power;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[power]}`;
};

export default function AvatarPicker({
  value,
  file,
  onPick,
  onClear,
  disabled,
  error,
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(value || "");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPreviewUrl(value || "");
  }, [value]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const meta = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name,
      size: formatBytes(file.size),
      type: file.type,
    };
  }, [file]);

  const pickFile = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFiles = (files) => {
    const next = files?.[0];
    if (!next) return;
    onPick?.(next);
  };

  return (
    <div className="w-full flex flex-col items-center gap-[10px]">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        className={[
          "relative select-none",
          "w-[120px] h-[120px] md:w-[150px] md:h-[150px]",
          "rounded-full overflow-hidden cursor-pointer",
          "border border-gray-700 bg-[#0a1010]",
          isDragging ? "ring-2 ring-blue-500/80" : "ring-0",
        ].join(" ")}
        onClick={pickFile}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        aria-label="Выбрать изображение профиля"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <FaCamera className="w-[22px] h-[22px]" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/35 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex items-center gap-[8px] text-white font-semibold text-[14px]">
            <FaCamera className="w-[16px] h-[16px]" />
            <span>{isDragging ? "Отпустите файл" : "Изменить"}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[520px]">
        <div className="flex items-center justify-center gap-[10px]">
          <button
            type="button"
            onClick={pickFile}
            disabled={disabled}
            className="text-blue-400 font-semibold hover:text-blue-300 transition-colors"
          >
            Поменять картинку профиля
          </button>
          {file ? (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="flex items-center gap-[6px] text-gray-300 hover:text-white transition-colors"
              title="Сбросить выбранное изображение"
            >
              <FaTrash className="w-[12px] h-[12px]" />
              Сброс
            </button>
          ) : null}
        </div>

        {meta ? (
          <div className="mt-[8px] text-center text-[12px] text-gray-400">
            {meta.name} • {meta.size}
          </div>
        ) : (
          <div className="mt-[8px] text-center text-[12px] text-gray-500">
            PNG/JPG/WEBP, перетащите файл сюда для быстрого выбора
          </div>
        )}

        {error ? (
          <div className="mt-[8px] text-center text-[12px] text-red-400">
            {error}
          </div>
        ) : null}

        <div className="mt-[12px] flex items-center justify-center gap-[10px]">
          <div className="flex items-center gap-[10px] bg-[#0a1010] border border-gray-800 rounded-2xl px-[14px] py-[10px]">
            <div className="text-gray-500 text-[12px]">Предпросмотр</div>
            <div className="flex items-center gap-[10px]">
              <div className="w-[52px] h-[52px] rounded-full overflow-hidden border border-gray-800">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="w-[34px] h-[34px] rounded-full overflow-hidden border border-gray-800 opacity-80">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="w-[22px] h-[22px] rounded-full overflow-hidden border border-gray-800 opacity-70">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
