// types/questionHistory.ts

export interface QuestionHistory {
  id: string;
  question: string;
  answers?: string[];
  correctAnswer?: string;
  listItems?: string[]; // For Top 10 lists
  category: string;
  subcategory: string;
  gameType: "trivia" | "topten";
  answeredCorrectly: boolean;
  timestamp: number; // Unix timestamp
  playerId?: string; // For competitive mode
}

export interface QuestionStats {
  totalAsked: number;
  totalCorrect: number;
  lastAsked: number;
  similarQuestions: string[]; // IDs of similar questions
}

