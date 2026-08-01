"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";
type Message = { role: "user" | "judy"; text: string };

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

function estimateEmotion(text: string) {
  const t = text.toLowerCase();
  if (/(congrat|great news|wonderful|excellent|happy)/.test(t)) return "happy";
  if (/(sorry|understand|difficult|concern|unfortunately)/.test(t)) return "empathetic";
  if (/(important|must|critical|careful)/.test(t)) return "serious";
  return "warm";
}

export default function VisualJudy() {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([
    { role: "judy", text: "Hello. I’m Judy. How can I help you today?" }
  ]);
  const [text, setText] = useState("");
  const [mouthOpen, setMouthOpen] = useState(0.15);
  const [blink, setBlink] = useState(false);
  const [emotion, setEmotion] = useState("warm");
  const recognitionRef = useRef<any>(null);
  const speakingRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3200 + Math.random() * 2600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setMouthOpen(.15);
    setStatus("idle");
  }, []);

  const speak = useCallback((content: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(content);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /samantha|aria|jenny|zira|ava|female/i.test(v.name)) ||
      voices.find(v => /^en/i.test(v.lang));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => {
      speakingRef.current = true;
      setStatus("speaking");
    };

    utter.onboundary = (e: any) => {
      // Browser TTS does not expose phonemes. This creates a useful V1 pseudo-viseme
      // animation from speech boundaries. Swap this for phoneme timestamps later.
      const seed = (e.charIndex ?? 1) % 7;
      const level = [0.25, 0.55, 0.85, 0.4, 1.0, 0.62, 0.32][seed];
      setMouthOpen(level);
      setTimeout(() => setMouthOpen(Math.max(.18, level * .35)), 85);
    };

    utter.onend = () => {
      speakingRef.current = false;
      setMouthOpen(.15);
      setStatus("idle");
    };

    utter.onerror = () => {
      speakingRef.current = false;
      setStatus("error");
      setTimeout(() => setStatus("idle"), 900);
    };

    window.speechSynthesis.speak(utter);
  }, []);

  const send = useCallback(async (raw: string) => {
    const userText = raw.trim();
    if (!userText) return;

    if (speakingRef.current) window.speechSynthesis.cancel();

    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setText("");
    setStatus("thinking");

    try {
      const history = [...messages, { role: "user", text: userText }].slice(-12);
      const res = await fetch("/api/judy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history })
      });
      const data = await res.json();
      const reply = data.reply || "I’m here. Please try that again.";
      setEmotion(data.emotion || estimateEmotion(reply));
      setMessages(prev => [...prev, { role: "judy", text: reply }]);
      speak(reply);
    } catch {
      setStatus("error");
      setMessages(prev => [...prev, {
        role: "judy",
        text: "I couldn't reach the JudyVA endpoint. Check the server configuration and try again."
      }]);
    }
  }, [messages, speak]);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages(prev => [...prev, {
        role: "judy",
        text: "Voice recognition is not available in this browser. Chrome desktop is recommended for this prototype."
      }]);
      return;
    }

    if (speakingRef.current) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      setText(finalText || interim);
      if (finalText.trim()) {
        recognition.stop();
        send(finalText);
      }
    };
    recognition.onerror = () => {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 900);
    };
    recognition.onend = () => {
      if (!speakingRef.current) setStatus(s => s === "thinking" ? s : "idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [send]);

  const mouthStyle = useMemo(() => ({
    transform: `translate(-50%, -50%) scaleY(${0.18 + mouthOpen * 1.5}) scaleX(${1 - mouthOpen * .08})`
  }), [mouthOpen]);

  return (
    <main className="page">
      <section className="card avatarCard">
        <div className="avatarStage">
          <div className={`judyWrap ${status}`}>
            <img className="judyImage" src="/judy.png" alt="Visual Judy" />
            <div className="mouth" style={mouthStyle} />
            <div className={`blink ${blink ? "active" : ""}`} />
          </div>
          <div className="statusPill">
            <span className={`dot ${status}`} />
            <strong>{status === "idle" ? "Ready" : status[0].toUpperCase() + status.slice(1)}</strong>
            <span className="small">• {emotion}</span>
          </div>
        </div>
      </section>

      <aside className="card panel">
        <div className="brand">
          <h1>Visual Judy™</h1>
          <p>JudyVA-compatible conversational avatar prototype.</p>
        </div>

        <div className="chat" ref={chatRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "user" : "judy"}`}>
              {m.text}
            </div>
          ))}
          {status === "thinking" && <div className="msg judy">Thinking…</div>}
        </div>

        <div className="controls">
          <div className="textRow">
            <input
              value={text}
              placeholder="Type to Judy…"
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") send(text);
              }}
            />
            <button onClick={() => send(text)} disabled={!text.trim()}>Send</button>
          </div>

          <div className="buttonRow">
            <button onClick={startListening}>
              🎙 Talk to Judy
            </button>
            <button className="secondary" onClick={stopSpeaking}>
              ■ Interrupt
            </button>
          </div>

          <p className="small">
            Chrome desktop is recommended for microphone recognition. The avatar uses browser TTS
            and approximate viseme motion in this first build. Connect <kbd>JUDYVA_API_URL</kbd> to route
            conversations into the real JudyVA engine.
          </p>
        </div>
      </aside>
    </main>
  );
}
