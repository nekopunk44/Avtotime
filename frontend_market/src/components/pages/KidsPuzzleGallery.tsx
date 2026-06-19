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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-2.5 animate-pulse">
              <div className="aspect-square rounded-lg bg-white/70" />
              <div className="h-3.5 mt-2.5 w-2/3 bg-white/70 rounded" />
              <div className="h-3 mt-1.5 w-1/2 bg-white/70 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((it) => {
            const thumb = coloredThumbs[it.id] || it.svgUrl;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelect(it.svgUrl, it.title || 'Пазлы')}
                className="rounded-xl border border-gray-100 bg-white p-2.5 text-left hover:shadow-md transition-shadow active:scale-[0.97]"
              >
                <div className="aspect-square rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                  <img
                    src={thumb}
                    alt={it.title}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                  />
                </div>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate leading-tight">{it.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {it.collection === 'coloring_mult' ? 'Мультфильмы' : 'Раскраски'}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Wand2 className="w-3.5 h-3.5 text-gray-600" />
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
