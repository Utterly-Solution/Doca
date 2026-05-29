import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { getSystemPrompt } from '@/lib/prompts';
import { ChatMode } from '@/lib/types';

const provider = process.env.AI_PROVIDER || 'groq';

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getGroqClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const { messages, documentText, mode, qaPairs } = (await req.json()) as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      documentText: string;
      mode: ChatMode;
      qaPairs?: string;
    };

    if (!documentText) {
      return new Response(JSON.stringify({ error: 'No document text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = getSystemPrompt(mode, documentText, qaPairs);
    const encoder = new TextEncoder();

    if (provider === 'anthropic') {
      return streamAnthropic(systemPrompt, messages, encoder);
    } else {
      return streamGroq(systemPrompt, messages, encoder);
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function streamAnthropic(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  encoder: TextEncoder
) {
  const anthropic = getAnthropicClient();
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Anthropic stream error:', error);
        const errData = JSON.stringify({ error: 'Stream failed' });
        controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function streamGroq(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  encoder: TextEncoder
) {
  const groq = getGroqClient();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          ],
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            const data = JSON.stringify({ text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Groq stream error:', error);
        const errData = JSON.stringify({ error: 'Stream failed' });
        controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
