# Deepgram Voice Recognition Setup

We've upgraded to **Deepgram** for advanced, reliable voice recognition. Deepgram uses state-of-the-art AI models (Nova-2) for highly accurate real-time transcription.

## Getting Your Deepgram API Key

1. Go to [https://console.deepgram.com/signup](https://console.deepgram.com/signup)
2. Sign up for a free account (includes $200 in free credits)
3. Navigate to your API keys section
4. Create a new API key
5. Copy the API key

## Setup

1. Add your Deepgram API key to `.env.local`:

```bash
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

2. Restart your Next.js development server:

```bash
npm run dev
```

## Features

- ✅ **Real-time streaming** - Continuous listening without interruption
- ✅ **High accuracy** - Nova-2 model with industry-leading performance
- ✅ **Auto-restart** - Automatically restarts for each new question
- ✅ **Works in all modern browsers** - Not limited to Chrome/Edge
- ✅ **Better error handling** - Clear error messages if something goes wrong

## Cost

Deepgram offers:
- **Free tier**: $200 in credits (approximately 50 hours of audio)
- **Pay-as-you-go**: Very affordable pricing after free tier
- Perfect for development and small to medium usage

## Troubleshooting

If you see "Deepgram API key not found":
1. Make sure you've added `NEXT_PUBLIC_DEEPGRAM_API_KEY` to `.env.local`
2. Restart your Next.js server after adding the key
3. Check that the key starts with a valid Deepgram format

If voice recognition doesn't start:
1. Check browser console for error messages
2. Make sure you've granted microphone permissions
3. Verify your API key is valid in the Deepgram console

