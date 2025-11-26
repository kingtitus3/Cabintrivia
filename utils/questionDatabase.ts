// utils/questionDatabase.ts

import fs from "fs";
import path from "path";
import type { QuestionHistory, QuestionStats } from "../types/questionHistory";

const DB_PATH = path.join(process.cwd(), "data", "questions.json");

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
  }
};

// Read all questions from database
export function getAllQuestions(): QuestionHistory[] {
  ensureDataDir();
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading questions database:", error);
    return [];
  }
}

// Save a question to the database
export function saveQuestion(question: QuestionHistory): void {
  ensureDataDir();
  const questions = getAllQuestions();
  questions.push(question);
  fs.writeFileSync(DB_PATH, JSON.stringify(questions, null, 2));
}

// Get questions that can be recycled (older than 2 hours)
export function getRecyclableQuestions(
  category: string,
  subcategory: string,
  gameType: "trivia" | "topten"
): QuestionHistory[] {
  const questions = getAllQuestions();
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  return questions.filter(
    (q) =>
      q.category === category &&
      q.subcategory === subcategory &&
      q.gameType === gameType &&
      q.timestamp < twoHoursAgo
  );
}

// Get questions asked in the last 2 hours (to avoid)
export function getRecentQuestions(
  category: string,
  subcategory: string,
  gameType: "trivia" | "topten"
): QuestionHistory[] {
  const questions = getAllQuestions();
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  return questions.filter(
    (q) =>
      q.category === category &&
      q.subcategory === subcategory &&
      q.gameType === gameType &&
      q.timestamp >= twoHoursAgo
  );
}

// Get statistics about correct answers for a category/subcategory
export function getQuestionStats(
  category: string,
  subcategory: string
): QuestionStats {
  const questions = getAllQuestions();
  const relevant = questions.filter(
    (q) => q.category === category && q.subcategory === subcategory
  );

  const correct = relevant.filter((q) => q.answeredCorrectly);
  const lastAsked = relevant.length > 0 
    ? Math.max(...relevant.map((q) => q.timestamp))
    : 0;

  // Find similar questions (same category/subcategory, answered correctly)
  const similarQuestions = correct
    .map((q) => q.id)
    .slice(-10); // Last 10 correct questions

  return {
    totalAsked: relevant.length,
    totalCorrect: correct.length,
    lastAsked,
    similarQuestions,
  };
}

// Get successful topics/themes from correct answers
export function getSuccessfulTopics(
  category: string,
  subcategory: string
): string[] {
  const questions = getAllQuestions();
  const correct = questions.filter(
    (q) =>
      q.category === category &&
      q.subcategory === subcategory &&
      q.answeredCorrectly
  );

  // Extract topics from correct answers
  const topics: string[] = [];
  
  correct.forEach((q) => {
    if (q.correctAnswer) {
      topics.push(q.correctAnswer);
    }
    if (q.listItems) {
      topics.push(...q.listItems);
    }
  });

  // Return unique topics, most recent first
  return [...new Set(topics)].slice(-20); // Last 20 unique topics
}

// Check if a question was recently asked (within 2 hours)
export function isQuestionRecent(
  questionText: string,
  category: string,
  subcategory: string,
  gameType: "trivia" | "topten"
): boolean {
  const recent = getRecentQuestions(category, subcategory, gameType);
  return recent.some(
    (q) => q.question.toLowerCase().trim() === questionText.toLowerCase().trim()
  );
}

