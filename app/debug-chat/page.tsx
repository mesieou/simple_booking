// Loads component inside the page
import ChatbotUI from "./chatbot-UI";

export default function DebugChatPage() {
    return (
        <div className="min-h-screen p-4">
            <h1 className="text-xl font-bold mb-4">Chatbot Debug</h1>
            <ChatbotUI />
        </div>
    );
}

