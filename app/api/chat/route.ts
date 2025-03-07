import { NextRequest, NextResponse } from 'next/server';
import { createChatCompletion, Message } from '../deepseek';

export async function POST(request: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      );
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY environment variable is not configured' },
        { status: 500 }
      );
    }

    const response = await createChatCompletion(messages);
    return NextResponse.json(response);
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