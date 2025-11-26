// components/SubcategoryModal.tsx

import React from "react";

interface Props {
  categoryName: string;
  categoryId?: string;
  subcategories: string[];
  onClose: () => void;
  onSelect: (sub: string, gameType?: "trivia" | "topten") => void;
}

export default function SubcategoryModal({
  categoryName,
  categoryId,
  subcategories,
  onClose,
  onSelect,
}: Props) {
  const isTopTenCategory = categoryId === "top_10";
  
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 md:p-6 z-40">
      <div className="cabin-panel w-full max-w-md px-5 py-5 md:px-6 md:py-6">
        <div className="mb-4 text-center">
          <p className="cabin-chip mx-auto mb-3">
            <span className="mr-1">📚</span> {categoryName}
          </p>
          <p className="text-xs text-slate-400">
            Pick a trail within this pack – you can always jump to Top 10 mode.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-4 max-h-[320px] overflow-y-auto pr-1">
          {subcategories.map((sub) => (
            <div key={sub} className="flex gap-2">
              {isTopTenCategory ? (
                <button
                  onClick={() => onSelect(sub, "topten")}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-left font-semibold text-amber-100 text-sm flex items-center gap-2"
                >
                  <span className="text-lg">🔟</span>
                  <span>{sub}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(sub, "trivia")}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800/80 text-left text-sm text-slate-100"
                  >
                    {sub}
                  </button>
                  <button
                    onClick={() => onSelect(sub, "topten")}
                    className="px-3 py-2.5 rounded-lg border border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-sm font-semibold"
                    title="Top 10 Lists"
                  >
                    🔟
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <button
          className="mt-4 w-full rounded-lg border border-slate-700/80 bg-slate-900/80 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
          onClick={onClose}
        >
          Back to cabin
        </button>
      </div>
    </div>
  );
}

