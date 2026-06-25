const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash-lite"];

function ensureApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  return apiKey;
}

function getModelCandidates() {
  const preferred = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const fallbacks = FALLBACK_MODELS.filter((model) => model !== preferred);
  return [preferred, ...fallbacks];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 503 || status === 429;
}

async function fileToBase64(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

async function callGeminiJson({ apiKey, systemInstruction, contents }) {
  const models = getModelCandidates();
  let lastError = "No models attempted.";

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.6,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error("Gemini returned an empty response.");
        }

        const trimmed = text
          .trim()
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "");

        return JSON.parse(trimmed);
      }

      lastError = await response.text();

      if (isRetryableStatus(response.status) && attempt === 0) {
        await sleep(2500);
        continue;
      }

      break;
    }
  }

  throw new Error(`Gemini request failed: ${lastError}`);
}

export async function extractContextFromImage({ imageFile, business, prompt }) {
  const apiKey = ensureApiKey();
  const imagePart = imageFile
    ? {
        inlineData: {
          mimeType: imageFile.type,
          data: await fileToBase64(imageFile),
        },
      }
    : null;

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `JobSnap CONTEXT_EXTRACTION.
Business context:
- Business name: ${business.business_name || "Unknown"}
- Trade: ${business.trade || "Unknown"}
- Location: ${business.location || "Unknown"}
- Tone: ${business.tone || "Unknown"}
- Website: ${business.website || "Unknown"}
- Instagram: ${business.instagram_handle || "Unknown"}

User goal:
${prompt || "No explicit goal provided."}

Extract the maximum useful marketing context from the image for social media generation. Return JSON with:
- scene_summary
- visible_details (array)
- likely_work_type
- business_value_points (array)
- local_signals (array)
- audience_takeaway
- recommended_angle
- confidence (0 to 1)
Keep it concise but detailed.`,
        },
        ...(imagePart ? [imagePart] : []),
      ],
    },
  ];

  return callGeminiJson({
    apiKey,
    systemInstruction:
      "You are a precise vision analysis engine. Return only valid JSON.",
    contents,
  });
}

export async function generatePostPackage({ imageFile, business, prompt, extraction }) {
  const apiKey = ensureApiKey();
  const imagePart = imageFile
    ? {
        inlineData: {
          mimeType: imageFile.type,
          data: await fileToBase64(imageFile),
        },
      }
    : null;

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `JobSnap caption generation.
Business context:
- Business name: ${business.business_name || "Unknown"}
- Trade: ${business.trade || "Unknown"}
- Location: ${business.location || "Unknown"}
- Tone: ${business.tone || "Unknown"}
- Website: ${business.website || "Unknown"}
- Instagram: ${business.instagram_handle || "Unknown"}

Image extraction:
${JSON.stringify(extraction)}

User goal:
${prompt || "No explicit goal provided."}

Generate JSON with:
- captions: array of exactly 3 items
Each caption item must include:
  - caption (detailed, personalized, growth-focused)
  - hashtags (array of 6 to 12 hashtags)
  - angle (short explanation)
- best_caption_index (0, 1, or 2)
Keep captions ready for Instagram and local business growth.`,
        },
        ...(imagePart ? [imagePart] : []),
      ],
    },
  ];

  return callGeminiJson({
    apiKey,
    systemInstruction:
      "You are a senior social media copywriter for local businesses. Return only valid JSON.",
    contents,
  });
}
