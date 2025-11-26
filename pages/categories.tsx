// pages/categories.tsx

import React, { useState } from "react";
import { categories } from "../data/categories";
import CategoryCard from "../components/CategoryCard";
import SubcategoryModal from "../components/SubcategoryModal";
import { useRouter } from "next/router";
import type { Category } from "../types/category";

export default function CategoriesPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const handleCategorySelect = (cat: Category) => {
    setActiveCategory(cat);
  };

  const handleSubcategorySelect = (sub: string, gameType: "trivia" | "topten" = "trivia") => {
    const { mode } = router.query;
    const isTopTenCategory = activeCategory?.id === "top_10";
    const pathname = gameType === "topten" || isTopTenCategory ? "/topten" : "/game";
    router.push({
      pathname,
      query: {
        mode: mode || "party",
        category: activeCategory?.id,
        subcategory: sub,
      },
    });
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] py-4">
      <div className="cabin-panel px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="cabin-chip mb-3 inline-flex">
              <span>Pick Your Trail</span>
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Where are we exploring tonight?
            </h1>
            <p className="mt-2 text-slate-400 text-sm md:text-base max-w-xl">
              From cozy cabin kitchens to national parks and classic TV nights,
              choose a pack that feels like your crew.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} onSelect={handleCategorySelect} />
          ))}
        </div>
      </div>

      {activeCategory && (
        <SubcategoryModal
          categoryName={activeCategory.name}
          categoryId={activeCategory.id}
          subcategories={activeCategory.subcategories}
          onClose={() => setActiveCategory(null)}
          onSelect={handleSubcategorySelect}
        />
      )}
    </div>
  );
}

