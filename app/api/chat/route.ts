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
  } catch (error: any) {
    console.error('Chat API error:', error);
    const errorMessage = error.message || 'Failed to process chat request';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}