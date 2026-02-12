import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface BillboardValidation {
  isValid: boolean;
  confidence: number; // 0-1
  reason: string;
  details: {
    isPhysicalBillboard: boolean;
    isInSanFrancisco: boolean;
    hasCompanyBranding: boolean;
    imageQuality: "high" | "medium" | "low";
  };
}

export async function validateBillboardImage(
  imageUrl: string,
): Promise<BillboardValidation> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[OpenAI] API key not configured, skipping validation");
      return {
        isValid: true, // Default to valid if no API key
        confidence: 0.5,
        reason: "OpenAI API key not configured",
        details: {
          isPhysicalBillboard: true,
          isInSanFrancisco: true,
          hasCompanyBranding: true,
          imageQuality: "medium",
        },
      };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and determine if it shows a real physical billboard/advertisement in San Francisco.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "isPhysicalBillboard": true/false,
  "isInSanFrancisco": true/false,
  "hasCompanyBranding": true/false,
  "imageQuality": "high"/"medium"/"low",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}

Criteria:
- isPhysicalBillboard: Is this an actual physical billboard (not a screenshot, news article image, digital mockup)?
- isInSanFrancisco: Does this appear to be in SF/Bay Area? (look for street signs, landmarks, architecture)
- hasCompanyBranding: Can you clearly see a company name or logo that could be redacted?
- imageQuality: Is the image clear enough to read text? (high=very clear, medium=readable, low=blurry)
- confidence: How certain are you this is a valid SF billboard photo? (0=not at all, 1=absolutely certain)

Be strict - only return high confidence if ALL criteria are clearly met.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);

    const isValid =
      parsed.isPhysicalBillboard &&
      parsed.isInSanFrancisco &&
      parsed.hasCompanyBranding &&
      parsed.imageQuality !== "low";

    return {
      isValid,
      confidence: parsed.confidence,
      reason: parsed.reason,
      details: {
        isPhysicalBillboard: parsed.isPhysicalBillboard,
        isInSanFrancisco: parsed.isInSanFrancisco,
        hasCompanyBranding: parsed.hasCompanyBranding,
        imageQuality: parsed.imageQuality,
      },
    };
  } catch (error) {
    console.error("[OpenAI] Validation error:", error);
    // On error, default to manual review (medium confidence)
    return {
      isValid: true,
      confidence: 0.5,
      reason: `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: {
        isPhysicalBillboard: true,
        isInSanFrancisco: true,
        hasCompanyBranding: true,
        imageQuality: "medium",
      },
    };
  }
}

export async function validateMultipleBillboards(
  imageUrls: string[],
): Promise<BillboardValidation[]> {
  const validations = await Promise.all(
    imageUrls.map((url) => validateBillboardImage(url)),
  );
  return validations;
}
