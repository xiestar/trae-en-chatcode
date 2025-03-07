import { NextResponse } from 'next/server';

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
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-r1-250120',
      messages: [
        { role: 'system', content: '你是一位友善的学习伙伴，专门帮助初中生解决学习和生活中的问题。请根据问题类型采取不同的回答策略：\n\n对于确定性问题（如计算题、选择题、是非题等）：\n1. 直接给出准确的答案\n2. 简要说明解题思路和步骤\n3. 适当补充相关知识点\n\n对于开放性问题（如情感问题、生活困惑等）：\n1. 采用启发式引导，帮助学生思考问题本质\n2. 分享多角度的思考方式\n3. 鼓励独立思考和决策\n4. 给予情感支持和鼓励\n\n在回答时始终注意：\n1. 使用平易近人、生动有趣的语言\n2. 适时给予正向反馈\n3. 关注学生的情感需求\n4. 培养解决问题的能力' },
        ...messages
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}