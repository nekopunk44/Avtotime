// Types for coloring game SVG files

export type ColoringCategory = 'cars' | 'special' | 'racing' | 'trucks' | 'cartoons';

export interface ColoringPart {
  id: string;
  name: string;
  path: string;
}

export interface ColoringTemplate {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  category: ColoringCategory;
  viewBox: string;
  width: number;
  height: number;
  parts: ColoringPart[];
  svgContent?: string; // Raw SVG content for canvas mode
}

// Metadata for SVG coloring files
export interface ColoringFileMetadata {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  category: ColoringCategory;
  viewBox: string;
  width: number;
  height: number;
}
