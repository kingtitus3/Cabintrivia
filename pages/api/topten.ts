// pages/api/topten.ts

import type { NextApiRequest, NextApiResponse } from "next";
import type { TopTenRound, TopTenRoundRequest } from "../../types/topTenRound";
import {
  getRecentQuestions,
  getSuccessfulTopics,
  saveQuestion,
} from "../../utils/questionDatabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopTenRound | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, subcategory }: TopTenRoundRequest = req.body;

  if (!category || !subcategory) {
    return res.status(400).json({ error: "Category and subcategory are required" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenRouter API key not configured" });
  }

  try {
    const isAllCategories = category === "all";
    const isAllLists = subcategory === "All Lists";
    const categoryContext = isAllCategories
      ? "any category (pets & animals, food & cooking, gaming, TV shows, outdoors, arts & crafts, fitness, general knowledge, chaos/fun, or dogs)"
      : `the category "${category}"`;
    
    const subcategoryContext = isAllLists
      ? "any interesting topic - choose from popular culture, food, sports, entertainment, technology, history, geography, or any other engaging subject that Americans would know"
      : `subcategory "${subcategory}"`;
    
    // Get successful topics from previous correct answers
    const successfulTopics = getSuccessfulTopics(category, subcategory);
    const topicsContext = successfulTopics.length > 0
      ? `\n\nPrevious successful topics that players enjoyed (you can create similar lists): ${successfulTopics.slice(-5).join(", ")}`
      : "";

    // Check for recent questions to avoid duplicates
    const recentQuestions = getRecentQuestions(category, subcategory, "topten");
    const avoidContext = recentQuestions.length > 0
      ? `\n\nAvoid these recently asked questions: ${recentQuestions.slice(-3).map(q => q.question).join("; ")}`
      : "";
    
    const prompt = `Generate a "Top 10" list question for ${categoryContext} and ${subcategoryContext}.${topicsContext}${avoidContext}

Requirements:
- Create a question asking for a top 10 list (e.g., "Name the top 10 most popular dog breeds in America" or "List the top 10 best-selling video games")
- Provide exactly 10 items in the list, ranked from most popular/common to least
- Make it fun and relevant to American culture
- Return your response in this exact JSON format:
{
  "question": "Your top 10 list question here?",
  "listItems": ["Item 1 (most popular)", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7", "Item 8", "Item 9", "Item 10 (least popular)"]
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
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenRouter API error:", errorData);
      return res.status(500).json({ error: "Failed to generate top ten list" });
    }

    const data = await response.json();
    
    // Handle different response formats from OpenRouter/Gemini
    let content: string;
    if (data.choices && data.choices[0]?.message?.content) {
      content = data.choices[0].message.content.trim();
    } else if (data.content) {
      content = data.content.trim();
    } else if (data.candidates && data.candidates[0]?.content?.parts) {
      // Gemini format
      content = data.candidates[0].content.parts[0]?.text?.trim() || "";
    } else {
      console.error("Unexpected API response format:", JSON.stringify(data, null, 2));
      return res.status(500).json({ error: "Unexpected API response format" });
    }

    if (!content) {
      console.error("No content in API response:", JSON.stringify(data, null, 2));
      return res.status(500).json({ error: "No content generated" });
    }

    // Parse the JSON response
    let roundData: TopTenRound;
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      roundData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response. Content:", content);
      console.error("Parse error:", parseError);
      return res.status(500).json({ error: `Failed to parse generated list: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` });
    }

    // Validate the response structure
    if (!roundData.question || !roundData.listItems) {
      return res.status(500).json({ error: "Invalid list structure generated" });
    }

    // Ensure we have exactly 10 items
    if (roundData.listItems.length !== 10) {
      return res.status(500).json({ error: "List must have exactly 10 items" });
    }

    // Save question to database
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    saveQuestion({
      id: questionId,
      question: roundData.question,
      listItems: roundData.listItems,
      category,
      subcategory,
      gameType: "topten",
      answeredCorrectly: false, // Will be updated as items are found
      timestamp: Date.now(),
    });

    // Add category and subcategory to the round
    const round: TopTenRound = {
      ...roundData,
      id: questionId,
      category,
      subcategory,
    };

    return res.status(200).json(round);
  } catch (error) {
    console.error("Error generating top ten list:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

