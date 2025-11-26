// types/round.ts

export type Round = {
  id?: string; // Question ID from database
  question: string;
  answers: string[];
  correctAnswer: string;
  category: string;
  subcategory: string;
};

export type RoundRequest = {
  category: string;
  subcategory: string;
};

