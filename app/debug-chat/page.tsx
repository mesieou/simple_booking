// Loads component inside the page
import ChatbotUI from "./chatbot-UI";

export default function DebugChatPage() {
    return (
        <div className="min-h-screen flex flex-row">
            <div className="flex flex-col gap-4 items-start mr-12">
                <a
                    href="https://wa.me/61412345678?text=Hi%20Skedy!"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-green-700 transition"
                >
                    Start Chat on WhatsApp
                </a>

                <h1 className="text-xl font-bold">Chatbot Debug</h1>
            </div>

            {/* Right side: Chatbot */}
            <ChatbotUI />
        </div>
    );
}

