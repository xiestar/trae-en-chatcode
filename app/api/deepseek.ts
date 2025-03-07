export interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
}

export interface ChatCompletionRequest {
  messages: Message[];
}

export interface ChatCompletionResponse {
  choices: {
    message: Message;
    finish_reason: string;
  }[];
}

export async function createChatCompletion(messages: Message[]): Promise<ChatCompletionResponse> {
  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-r1-250120',
        messages: [
          { role: 'system', content: '你是人工智能助手.' },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API error (${response.status}): ${errorData || response.statusText}`);
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    return response.json();
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw error;
  }
}