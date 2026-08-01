import { NextRequest, NextResponse } from "next/server";

type HistoryItem = {
  role: "user" | "judy";
  text: string;
};

function localPrototypeReply(message: string) {
  const m = message.toLowerCase();

  if (/\b(hello|hi|hey)\b/.test(m)) {
    return "Hello! I’m Judy. I’m ready to help. What would you like to work on?";
  }

  if (/who are you|what are you/.test(m)) {
    return "I’m Judy, a visual AI assistant interface designed to work with the JudyVA engine.";
  }

  if (/appointment|schedule|book/.test(m)) {
    return "I can help with scheduling once the JudyVA tool layer is connected to this prototype.";
  }

  if (/what can you do|help me/.test(m)) {
    return "I can answer questions, hold a voice conversation, and serve as the visual interface for JudyVA. Once connected, I can also use JudyVA’s business knowledge, workflows, tools, and memory.";
  }

  return `I heard you say: “${message}.” This prototype is working. Connect the JudyVA endpoint and I will answer using the full JudyVA engine instead of the local demo response.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history as HistoryItem[] : [];

  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const judyUrl = process.env.JUDYVA_API_URL;
  const judyKey = process.env.JUDYVA_API_KEY;

  if (judyUrl) {
    try {
      const response = await fetch(judyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(judyKey ? { Authorization: `Bearer ${judyKey}` } : {})
        },
        body: JSON.stringify({
          message,
          history,
          channel: "visual-judy",
          metadata: {
            source: "visual-judy-prototype"
          }
        }),
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`JudyVA returned ${response.status}`);
      }

      const data = await response.json();

      // Adapter accepts several common response shapes.
      const reply =
        data.reply ??
        data.message ??
        data.response ??
        data.text ??
        data.output?.text ??
        data.output_text;

      if (!reply) {
        throw new Error("JudyVA response did not contain recognizable text.");
      }

      return NextResponse.json({
        reply,
        emotion: data.emotion ?? "warm",
        source: "judyva"
      });
    } catch (error) {
      console.error("JudyVA adapter error:", error);
      return NextResponse.json({
        reply: "I reached the JudyVA adapter, but the JudyVA service did not return a usable response. Please check the endpoint contract.",
        emotion: "concerned",
        source: "judyva-error"
      });
    }
  }

  return NextResponse.json({
    reply: localPrototypeReply(message),
    emotion: "warm",
    source: "local-prototype"
  });
}
