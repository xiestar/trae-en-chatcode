import { NextRequest, NextResponse } from 'next/server';
import { createChatCompletion, Message } from '../deepseek';

export async function POST(request: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'DEEPSEEK_API_KEY environment variable is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stream = await createChatCompletion(messages);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    let errorMessage = 'Failed to process chat request';
    if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
      if ('cause' in error) {
        errorMessage += `\nCause: ${error.cause}`;
      }
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = `Error: ${JSON.stringify(error)}`;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}