// app/debug-chat/chatbot-UI.tsx 
// Chat UI Component
// This tells next js that this is a "client component", meaning it will run in the browser.
// Without this, React features like useState wont work in this file.

"use client"; // "This file should be trated as a client side react component, not a server component"

// Import the useState, useRef, and useEffect hooks from react to store user input and chat history in memory
import { useState, useRef, useEffect } from "react";
import {Slot} from "@/lib/bot/helpers/slots";

// This is the main UI component for the chatbot
export default function ChatbotUI() {

    // msg: stores what the user is currently typing into the input box
    // setmsg updates the msg var when the user types something
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    // history stores the full conversation (all user + bot msgs)
    // sethistory updates the conversation history
    const [history, setHistory] = useState<any[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when history changes
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    return (
        <div className="fixed inset-0 flex items-center justify-center z-10 bg-transparent">
            <div className="flex flex-col w-full max-w-md h-[80vh] bg-card rounded-lg shadow-lg border border-border">
                {/* === Chat history section === */}
                <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto space-y-4 p-4 custom-scrollbar"
                >
                    {history
                    .filter((m) => m.role !== "assistant" || m.function_call === undefined)
                    .map((m, i) => {
                        /* ----- FUNCTION / TOOL MESSAGES ----- */
                        if (m.role === "function") {
                        switch (m.name) {
                            case "get_quote": {
                            // Quote returned as JSON string -> convert to object
                            const q = JSON.parse(m.content);
                            return (
                                <div key={i} className="text-left">
                                    <div className="inline-block bg-primary/20 px-4 py-2 rounded-lg text-primary-foreground">
                                        Base ${q.baseFare}  +  ${q.labourRatePerMin}/min labour
                                    </div>
                                </div>
                                );
                            }

                            case "book_slot": {
                                return (
                                    <div key={i} className="text-left">
                                        <div className="bg-primary/20 px-4 py-2 rounded-lg text-primary-foreground">
                                            ✅ Booking confirmed! See you then.
                                        </div>
                                    </div>
                                );
                            }
                            default:
                            return null; // hide any other function types for now
                        }
                    }

                    return (
                        <div 
                            key={i}
                            className={`${
                                m.role === "user" ? "text-right" : "text-left"
                            }`}
                        >
                            <div 
                                className={`inline-block px-4 py-2 rounded-lg ${
                                    m.role === "user" 
                                        ? "bg-primary text-primary-foreground" 
                                        : "bg-secondary/20 text-secondary-foreground"
                                } max-w-lg break-words`}
                            >
                                {m.content ?? m.function_call?.name ?? "Bot"}
                            </div>
                        </div>
                    );     
                    })}
                </div>
                
                {/* === Input box === */}
                {/*This is where the user types their message */}
                <div className="p-4 border-t border-border bg-card rounded-b-lg">
                    {loading && (
                        <div className="text-left text-sm italic text-muted-foreground mb-2">Bot is thinking…</div>
                    )}
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            className="flex-1 bg-background border border-input rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Type a message and press enter"
                            value={msg} // This binds the input box to the msg stat
                            onChange={(e) => setMsg(e.target.value)} // update msg when user types
                            onKeyDown={(e) => e.key === "Enter" && send()} // if user press enter, call send()
                        />
                        <button 
                            onClick={send}
                            className="btn px-4 py-2"
                            disabled={!msg.trim() || loading}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, hsl(var(--primary)), hsl(var(--secondary)));
                    border-radius: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: hsl(var(--primary)) transparent;
                }
            `}</style>
        </div>
    );

    // === Function to send a message ===
    async function send(){
        // dont send if the message is empty or just spaces
        if (!msg.trim()) return;

        
        // add the new message to the chat history (as a user message)
        const next = [...history, { role:"user", content:msg}];
        setHistory(next); // update the screen with the new message
        setMsg(""); // Clear the input box

        setLoading(true);

        try {
            // call backend
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ history: next }),
            });

            const data = await res.json();

            // update the conversation with bot response (full history returned)
            setHistory(data.history);
        } catch (err) {
            console.error("Chat error:",  err);
            setHistory([
                ...next, {
                    role:"assistant",
                    content:"Something went wrong talking to the bot.",
                },
            ]);
        } finally {
            // Hide bot is thinking 
            setLoading(false)
        }
    }
}


// 1. You type something like "hi i want to move from 123 main st to 123 example ave"
// 2. The message isadded to the hitory state
// 3. the ui sends this to /Api/chat on the backend 
// 4. The backend detects a get_quota function call 
// 5. it returns the quote ($90 base + $2.62/min)
// 6. The response is added to the caht and shown as a bubble
