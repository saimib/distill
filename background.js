const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const PROMPTS = {
  bullets: `Summarize this YouTube video in 5–7 concise bullet points.
Cover the core ideas and key takeaways. Use "• " to start each bullet.`,

  detailed: `Provide a structured summary of this YouTube video with these sections:
## Overview
## Main Points
## Key Insights
## Conclusion
Be thorough but clear.`,

  takeaways: `Extract the 3–5 most important actionable takeaways or lessons from this YouTube video.
Number each one. Focus on what someone should remember or do after watching.`,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DISTILL_VIDEO') {
    distillVideo(message.videoUrl, message.mode)
      .then(summary => sendResponse({ success: true, summary }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function distillVideo(videoUrl, mode = 'bullets') {
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);

  if (!apiKey) {
    throw new Error('No API key set. Click the Distill extension icon to add your Gemini API key.');
  }

  const selectedModel = model || 'gemini-2.5-flash';
  const prompt = PROMPTS[mode] || PROMPTS.bullets;

  const res = await fetch(
    `${GEMINI_BASE}/${selectedModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { file_data: { file_uri: videoUrl } },
          ],
        }],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}
