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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-6">
      <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-center">{categoryName}</h2>

        <div className="grid grid-cols-1 gap-3 mb-4">
          {subcategories.map((sub) => (
            <div key={sub} className="flex gap-2">
              {isTopTenCategory ? (
                // For Top 10 Lists category, main button goes directly to Top 10 Lists mode
                <button
                  onClick={() => onSelect(sub, "topten")}
                  className="flex-1 p-3 border rounded-lg bg-blue-50 hover:bg-blue-100 text-left font-semibold"
                >
                  🔟 {sub}
                </button>
              ) : (
                // For other categories, show both options
                <>
                  <button
                    onClick={() => onSelect(sub, "trivia")}
                    className="flex-1 p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    {sub}
                  </button>
                  <button
                    onClick={() => onSelect(sub, "topten")}
                    className="px-4 py-3 border rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold"
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
          className="mt-5 w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

