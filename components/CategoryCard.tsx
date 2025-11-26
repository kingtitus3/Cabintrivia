// components/CategoryCard.tsx

import React from "react";
import type { Category } from "../types/category";

interface Props {
  category: Category;
  onSelect: (cat: Category) => void;
}

export default function CategoryCard({ category, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(category)}
      className="cabin-panel group flex flex-col items-start justify-between px-4 py-4 md:px-5 md:py-5 text-left cursor-pointer hover:border-amber-400/70 hover:shadow-2xl hover:-translate-y-1 transition"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-2xl shadow-md shadow-slate-900/80">
          {category.emoji}
        </div>
        <h2 className="text-sm md:text-base font-semibold text-slate-50 tracking-tight group-hover:text-amber-200">
          {category.name}
        </h2>
      </div>
      <p className="text-[11px] md:text-xs text-slate-400 leading-snug line-clamp-2">
        {category.subcategories.slice(0, 2).join(" • ")}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-amber-300/90 group-hover:text-amber-200">
        <span>Enter cabin</span>
        <span className="translate-x-0 group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </span>
    </button>
  );
}


