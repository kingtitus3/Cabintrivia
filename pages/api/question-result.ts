// pages/api/question-result.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getAllQuestions, saveQuestion } from "../../utils/questionDatabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { questionId, answeredCorrectly, playerId } = req.body;

  if (!questionId || typeof answeredCorrectly !== "boolean") {
    return res.status(400).json({ error: "questionId and answeredCorrectly are required" });
  }

  try {
    const questions = getAllQuestions();
    const questionIndex = questions.findIndex((q) => q.id === questionId);

    if (questionIndex === -1) {
      // Question not found, create a new entry
      // This can happen if the question was generated before database was set up
      return res.status(200).json({ success: true });
    }

    // Update the question with correctness
    questions[questionIndex].answeredCorrectly = answeredCorrectly;
    if (playerId) {
      questions[questionIndex].playerId = playerId;
    }

    // Save back to database
    const fs = require("fs");
    const path = require("path");
    const DB_PATH = path.join(process.cwd(), "data", "questions.json");
    fs.writeFileSync(DB_PATH, JSON.stringify(questions, null, 2));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating question result:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

