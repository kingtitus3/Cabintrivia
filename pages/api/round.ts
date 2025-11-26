// pages/api/round.ts

import type { NextApiRequest, NextApiResponse } from "next";
import type { Round, RoundRequest } from "../../types/round";
import {
  getRecentQuestions,
  getSuccessfulTopics,
  saveQuestion,
  isQuestionRecent,
} from "../../utils/questionDatabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Round | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, subcategory }: RoundRequest = req.body;

  if (!category || !subcategory) {
    return res.status(400).json({ error: "Category and subcategory are required" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenRouter API key not configured" });
  }

  try {
    // Create a prompt for generating trivia questions
    const isAllCategories = category === "all";
    const categoryContext = isAllCategories
      ? "any category (pets & animals, food & cooking, gaming, TV shows, outdoors, arts & crafts, fitness, general knowledge, chaos/fun, or dogs)"
      : `the category "${category}"`;
    
    const prompt = isAllCategories
      ? `Generate a trivia question from ${categoryContext}. The question can be about any topic that Americans would know.

Requirements:
- Create ONE engaging trivia question that Americans would know
- Choose any interesting topic from any category
- Provide 4 possible answers (one correct, three plausible distractors)
- Make it fun and accessible to a general American audience
- Return your response in this exact JSON format:
{
  "question": "Your question here?",
  "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"],
  "correctAnswer": "The correct answer"
}

Only return the JSON, no additional text.`
      : `Generate a trivia question for ${categoryContext} and subcategory "${subcategory}".

Requirements:
- Create ONE engaging trivia question that Americans would know
- Provide 4 possible answers (one correct, three plausible distractors)
- The question should be specific to the subcategory
- Make it fun and accessible to a general American audience
- Return your response in this exact JSON format:
{
  "question": "Your question here?",
  "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"],
  "correctAnswer": "The correct answer"
}

Only return the JSON, no additional text.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Cabin Trivia",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenRouter API error:", errorData);
      return res.status(500).json({ error: "Failed to generate round" });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      return res.status(500).json({ error: "No content generated" });
    }

    // Parse the JSON response
    let roundData: Round;
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      roundData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return res.status(500).json({ error: "Failed to parse generated round" });
    }

    // Validate the response structure
    if (!roundData.question || !roundData.answers || !roundData.correctAnswer) {
      return res.status(500).json({ error: "Invalid round structure generated" });
    }

    // Ensure we have exactly 4 answers
    if (roundData.answers.length !== 4) {
      return res.status(500).json({ error: "Round must have exactly 4 answers" });
    }

    // Add category and subcategory to the round
    const round: Round = {
      ...roundData,
      id: questionId,
      category,
      subcategory,
    };

    // Save question to database (initially marked as not answered)
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    saveQuestion({
      id: questionId,
      question: roundData.question,
      answers: roundData.answers,
      correctAnswer: roundData.correctAnswer,
      category,
      subcategory,
      gameType: "trivia",
      answeredCorrectly: false, // Will be updated when answered
      timestamp: Date.now(),
    });

    return res.status(200).json(round);
  } catch (error) {
    console.error("Error generating round:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

