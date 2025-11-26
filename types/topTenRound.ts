// types/topTenRound.ts

export type TopTenRound = {
  id?: string; // Question ID from database
  question: string;
  listItems: string[]; // The 10 items in the list
  category: string;
  subcategory: string;
};

export type TopTenRoundRequest = {
  category: string;
  subcategory: string;
};

