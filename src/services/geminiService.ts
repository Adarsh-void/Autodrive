import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function predictNextService(
  vehicleName: string, 
  year: number, 
  fuelType: string, 
  lastServiceDate?: string,
  totalKm?: number,
  avgDailyKm?: number,
  serviceIntervalKm?: number,
  serviceIntervalMonths?: number
) {
  try {
    const prompt = `
      Act as a professional automotive service advisor. 
      Predict the next recommended service date and urgency for a ${year} ${vehicleName} (${fuelType}).
      
      Vehicle Data:
      - Last Service Date: ${lastServiceDate || 'Never'}
      - Total Kilometers: ${totalKm || 'Unknown'} km
      - Average Daily Usage: ${avgDailyKm || 'Unknown'} km/day
      - Recommended Service Interval: Every ${serviceIntervalKm || 5000} km or ${serviceIntervalMonths || 6} months
      
      Current date is ${new Date().toLocaleDateString()}.
      
      Consider standard maintenance schedules for this type of vehicle.
      Return a JSON object with:
      1. predictedDate: ISO date string
      2. urgency: "Low", "Medium", or "High"
      3. explanation: Brief reasoning for the prediction
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedDate: { type: Type.STRING, description: "ISO date string" },
            urgency: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            explanation: { type: Type.STRING, description: "Reasoning for the prediction" }
          },
          required: ["predictedDate", "urgency", "explanation"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Prediction failed:", error);
    return {
      predictedDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      urgency: "Low",
      explanation: "Standard maintenance interval recommended."
    };
  }
}
