# Visual Judy™ Prototype

A browser-based conversational avatar prototype designed to sit on top of the existing JudyVA™ engine.

## What works now

- Judy image used as the avatar identity
- microphone input in supported browsers
- speech-to-text using the browser Web Speech API
- conversation UI
- server-side JudyVA adapter
- browser text-to-speech
- approximate lip movement while Judy speaks
- blinking / idle motion
- listening / thinking / speaking states
- interruption button
- local demo fallback when JudyVA is not connected

## Important V1 limitation

The current lip sync is a prototype pseudo-viseme system driven by browser TTS boundary events.

This proves the end-to-end architecture, but it is **not yet production-grade phoneme lip sync**.

The next visual milestone should replace browser TTS with a streaming TTS provider that exposes
phoneme/viseme timestamps, or add a phoneme alignment stage.

## Run locally

```bash
npm install
npm run dev
```

Open:

http://localhost:3000

Chrome desktop is recommended for microphone recognition.

## Connect to JudyVA

Copy:

```bash
cp .env.example .env.local
```

Set:

```env
JUDYVA_API_URL=https://YOUR-JUDYVA-ENDPOINT
JUDYVA_API_KEY=OPTIONAL_SERVER_KEY
```

The adapter sends:

```json
{
  "message": "user text",
  "history": [],
  "channel": "visual-judy",
  "metadata": {
    "source": "visual-judy-prototype"
  }
}
```

It currently recognizes these common reply fields:

- `reply`
- `message`
- `response`
- `text`
- `output.text`
- `output_text`

If JudyVA uses a different contract, edit:

`app/api/judy/route.ts`

## Deployment

This project is structured for:

GitHub → Vercel

Add `JUDYVA_API_URL` and `JUDYVA_API_KEY` as Vercel environment variables.

## Next milestone

1. Replace browser TTS with streaming TTS.
2. Obtain phoneme/viseme timestamps.
3. Replace the simple mouth overlay with facial-region deformation or a 2.5D rig.
4. Add true barge-in based on voice activity detection.
5. Add JudyVA session IDs / tenant IDs.
6. Add Firebase session logging.
