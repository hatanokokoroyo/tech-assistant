/**
 * SSE 客户端 — 连接 AI 流式对话端点。
 *
 * Usage:
 *   const ctrl = streamChat(convId, content, onEvent)
 *   ctrl.abort()  // 取消
 */
export interface StreamEvent {
    event: string
    data: any
}

export interface StreamMessage {
    type: 'text' | 'reasoning' | 'tool_call_progress' | 'tool_result' | 'done'
    content?: string
    tool_call_id?: string
    tool_name?: string
}

export function streamChat(
    conversationId: number,
    content: string,
    onEvent: (msg: StreamMessage) => void,
    onError?: (err: any) => void,
    onDone?: () => void,
): AbortController {
    const controller = new AbortController()
    const token = localStorage.getItem('token') || ''

    fetch(`/api/conversations/${conversationId}/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
    })
        .then(async (response) => {
            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: '请求失败' }))
                onError?.(err.detail || '未知错误')
                return
            }

            const reader = response.body?.getReader()
            if (!reader) return

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                let eventType = ''
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim()
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (eventType === 'message_end') {
                                onDone?.()
                                return
                            }
                            if (eventType === 'token') {
                                onEvent(data as StreamMessage)
                            }
                            eventType = ''
                        } catch {
                            // 忽略解析失败
                        }
                    }
                }
            }
            onDone?.()
        })
        .catch((err) => {
            if (err.name !== 'AbortError') {
                onError?.(err)
            }
        })

    return controller
}
