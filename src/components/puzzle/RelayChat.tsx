'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  userId: string;
  userName: string;
  userRole: 'solver' | 'decoder';
  message: string;
  createdAt: Date;
}

interface RelayChatProps {
  roomId: string;
  currentUserId: string;
  currentUserRole: 'solver' | 'decoder';
  currentUserName?: string;
  onSendMessage: (message: string) => Promise<void>;
  initialMessages?: Message[];
}

export default function RelayChat({
  roomId,
  currentUserId,
  currentUserRole,
  currentUserName = 'You',
  onSendMessage,
  initialMessages = [],
}: RelayChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling for new messages (optional: upgrade to WebSocket later)
  useEffect(() => {
    const pollMessages = async () => {
      try {
        const res = await fetch(`/api/puzzles/relay/messages?roomId=${roomId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    pollMessages(); // Initial fetch
    const interval = setInterval(pollMessages, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [roomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(inputValue);
      setInputValue('');
      // Message will appear via polling
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const getRoleColor = (role: 'solver' | 'decoder') => {
    return role === 'solver' ? '#3891A6' : '#FDE74C';
  };

  const getRoleBg = (role: 'solver' | 'decoder') => {
    return role === 'solver' ? 'rgba(56, 145, 166, 0.2)' : 'rgba(253, 231, 76, 0.15)';
  };

  return (
    <div className="flex flex-col h-full border-l" style={{ borderLeftColor: 'rgba(56, 145, 166, 0.2)', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
      {/* Header */}
      <div className="border-b p-4" style={{ borderBottomColor: 'rgba(56, 145, 166, 0.2)' }}>
        <h3 className="text-lg font-bold text-white">💬 Team Chat</h3>
        <p className="text-xs" style={{ color: '#AB9F9D' }}>Collaborate with your partner</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#AB9F9D' }} className="text-sm">
              No messages yet. Start collaborating!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-xs px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: isOwn
                      ? 'rgba(124, 58, 237, 0.3)'
                      : getRoleBg(msg.userRole),
                    borderLeft: isOwn ? 'none' : `3px solid ${getRoleColor(msg.userRole)}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isOwn ? '#7C3AED' : getRoleColor(msg.userRole) }}
                    >
                      {isOwn ? 'You' : msg.userName}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: getRoleBg(msg.userRole),
                        color: getRoleColor(msg.userRole),
                      }}
                    >
                      {msg.userRole === 'solver' ? '🔍' : '🔐'}
                    </span>
                  </div>
                  <p className="text-sm text-white break-words">{msg.message}</p>
                  <p className="text-xs mt-1" style={{ color: '#AB9F9D' }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t p-4 space-y-2"
        style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)' }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Share clues, hints, or the key..."
            className="flex-1 px-3 py-2 rounded-lg border text-sm text-white placeholder-gray-500 transition"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderColor: '#3891A6',
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            className="px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50"
            style={{
              backgroundColor: '#3891A6',
              color: 'white',
              cursor: !inputValue.trim() || sending ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? '⏳' : '📤'}
          </button>
        </div>
        <p className="text-xs" style={{ color: '#AB9F9D' }}>
          💡 Tip: Share your progress, hints, or the decryption key via chat
        </p>
      </form>
    </div>
  );
}
