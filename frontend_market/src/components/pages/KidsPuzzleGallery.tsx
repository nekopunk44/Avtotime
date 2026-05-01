import React, { useEffect, useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { fetchColoringTemplateList, buildPublicSvgUrl, type ColoringTemplateListItem } from '../../utils/coloringLoader';
import { gameAPI } from '../../utils/gameAPI';

type GalleryItem = ColoringTemplateListItem & {
  svgUrl: string;
};

type KidsPuzzleGalleryProps = {
  onSelect: (svgUrl: string, title: string) => void;
};

const CONCURRENCY = 3;

export const KidsPuzzleGallery: React.FC<KidsPuzzleGalleryProps> = ({ onSelect }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [coloredThumbs, setColoredThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [a, b] = await Promise.all([
          fetchColoringTemplateList('coloring'),
          fetchColoringTemplateList('coloring_mult'),
        ]);
        const merged: GalleryItem[] = [...a, ...b].map((t) => ({
          ...t,
          svgUrl: buildPublicSvgUrl(t.collection, t.filename),
        }));
        if (mounted) setItems(merged);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Не удалось загрузить список шаблонов');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const title = String(it.title || '').trim();
      // Hide templates with "title" being just a number like "1", "2", "10", etc.
      if (/^\d+$/.test(title)) return false;
      return true;
    });
  }, [items]);

  // Request colored thumbnails in the background (bounded concurrency).
  useEffect(() => {
    if (filtered.length === 0) return;
    let cancelled = false;
    let cursor = 0;

    const worker = async () => {
      while (!cancelled) {
        const index = cursor++;
        const it = filtered[index];
        if (!it) return;
        if (coloredThumbs[it.id]) continue;

        try {
          const response = await gameAPI.requestSvgColoring({
            svgContent: it.svgUrl,
            templateId: it.id,
          });
          if (cancelled) return;
          if (response.success && response.coloredSvg) {
            setColoredThumbs((prev) => ({ ...prev, [it.id]: response.coloredSvg! }));
          }
        } catch {
          // ignore; fallback will show monochrome SVG
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
    // Intentionally not depending on coloredThumbs to avoid restarting workers frequently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  return (
    <div className="w-full">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 animate-pulse">
              <div className="aspect-[16/9] rounded-xl bg-white/70" />
              <div className="h-4 mt-3 w-2/3 bg-white/70 rounded" />
              <div className="h-3 mt-2 w-1/2 bg-white/70 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it) => {
            const thumb = coloredThumbs[it.id] || it.svgUrl;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelect(it.svgUrl, it.title || 'Пазлы')}
                className="rounded-2xl border border-gray-100 bg-white p-4 text-left hover:shadow-sm transition-shadow"
              >
                <div className="aspect-[16/9] rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                  <img
                    src={thumb}
                    alt={it.title}
                    className="w-full h-full object-contain p-3"
                    loading="lazy"
                  />
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">{it.title}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {it.collection === 'coloring_mult' ? 'Мультфильмы' : 'Раскраски'}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Wand2 className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
