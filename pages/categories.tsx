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
    // If category is "top_10", automatically use Top 10 Lists mode
    const isTopTenCategory = activeCategory?.id === "top_10";
    const pathname = (gameType === "topten" || isTopTenCategory) ? "/topten" : "/game";
    router.push({
      pathname,
      query: {
        mode: mode || "party", // Default to party if mode not provided
        category: activeCategory?.id,
        subcategory: sub,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Choose a Category</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
        {categories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} onSelect={handleCategorySelect} />
        ))}
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

