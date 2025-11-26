// hooks/useCategorySelection.ts

import { useState } from "react";
import type { Category } from "../types/category";

export function useCategorySelection() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  return {
    selectedCategory,
    setSelectedCategory,
    selectedSubcategory,
    setSelectedSubcategory,
  };
}

