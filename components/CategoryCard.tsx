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
      className="bg-white shadow-md hover:shadow-xl transition rounded-xl p-6 text-center border border-gray-200 flex flex-col items-center justify-center cursor-pointer"
    >
      <div className="text-4xl mb-2">{category.emoji}</div>
      <div className="text-lg font-semibold">{category.name}</div>
    </button>
  );
}

