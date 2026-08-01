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

function pickJudyVoice(voices: SpeechSynthesisVoice[]) {
  const preferredNames = [
    /microsoft aria/i,
    /microsoft jenny/i,
    /microsoft zira/i,
    /microsoft ava/i,
    /samantha/i,
    /victoria/i,
    /karen/i,
    /moira/i,
    /serena/i,
    /female/i,
    /aria/i,
    /jenny/i,
    /zira/i,
    /ava/i
  ];

  for (const pattern of preferredNames) {
    const match = voices.find(v => pattern.test(v.name) && /^en/i.test(v.lang));
    if (match) return match;
  }

  return voices.find(v => /^en-US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
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
  const mouthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const stopMouthAnimation = useCallback(() => {
    if (mouthTimerRef.current) {
      clearInterval(mouthTimerRef.current);
      mouthTimerRef.current = null;
    }
    setMouthOpen(.15);
  }, []);

  const startFallbackMouthAnimation = useCallback(() => {
    stopMouthAnimation();
    mouthTimerRef.current = setInterval(() => {
      if (!speakingRef.current) return;
      const levels = [0.28, 0.48, 0.72, 0.92, 0.58, 0.35, 0.82, 0.44];
      const next = levels[Math.floor(Math.random() * levels.length)];
      setMouthOpen(next);
    }, 110);
  }, [stopMouthAnimation]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    stopMouthAnimation();
    setStatus("idle");
  }, [stopMouthAnimation]);

  const speak = useCallback((content: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    stopMouthAnimation();

    const utter = new SpeechSynthesisUtterance(content);
    utter.rate = 0.98;
    utter.pitch = 1.08;
    utter.volume = 1.0;

    const assignBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = pickJudyVoice(voices);
      if (preferred) utter.voice = preferred;
    };

    assignBestVoice();

    utter.onstart = () => {
      speakingRef.current = true;
      setStatus("speaking");
      startFallbackMouthAnimation();
    };

    utter.onboundary = (e: any) => {
      // If the browser exposes word boundaries, use them to vary the mouth shape.
      // The fallback animation keeps the lips moving on browsers that do not expose boundaries.
      const seed = (e.charIndex ?? 1) % 7;
      const level = [0.25, 0.55, 0.85, 0.4, 1.0, 0.62, 0.32][seed];
      setMouthOpen(level);
      setTimeout(() => {
        if (speakingRef.current) setMouthOpen(Math.max(.2, level * .42));
      }, 85);
    };

    utter.onend = () => {
      speakingRef.current = false;
      stopMouthAnimation();
      setStatus("idle");
    };

    utter.onerror = () => {
      speakingRef.current = false;
      stopMouthAnimation();
      setStatus("error");
      setTimeout(() => setStatus("idle"), 900);
    };

    // Some browsers load the voice list asynchronously. A short retry improves Windows/Chrome voice selection.
    if (window.speechSynthesis.getVoices().length === 0) {
      const handleVoicesChanged = () => {
        assignBestVoice();
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        window.speechSynthesis.speak(utter);
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          assignBestVoice();
          window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
          window.speechSynthesis.speak(utter);
        }
      }, 500);
    } else {
      window.speechSynthesis.speak(utter);
    }
  }, [startFallbackMouthAnimation, stopMouthAnimation]);

  const send = useCallback(async (raw: string) => {
    const userText = raw.trim();
    if (!userText) return;

    if (speakingRef.current) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
      stopMouthAnimation();
    }

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
  }, [messages, speak, stopMouthAnimation]);

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
      stopMouthAnimation();
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
  }, [send, stopMouthAnimation]);

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
            Chrome desktop is recommended for microphone recognition. This build strongly prefers a female system voice and now includes fallback mouth animation while Judy speaks. Connect <kbd>JUDYVA_API_URL</kbd> to route conversations into the real JudyVA engine.
          </p>
        </div>
      </aside>
    </main>
  );
}
