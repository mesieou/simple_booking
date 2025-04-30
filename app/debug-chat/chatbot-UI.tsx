// app/debug-chat/chatbot-UI.tsx 
// Chat UI Component
// This tells next js that this is a "client component", meaning it will run in the browser.
// Without this, React features like useState wont work in this file.

"use client"; // "This file should be trated as a client side react component, not a server component"

// Import the useState hook from react to store user input and chat history in memory
import { useState } from "react";

// This is the main UI component for the chatbot
export default function ChatbotUI() {
    // msg: stores what the user is currently typing into the input box
    // setmsg updates the msg var when the user types something
    const [msg, setMsg] = useState("");

    // history stores the full conversation (all user + bot msgs)
    // sethistory updates the conversation history
    const [history, setHistory] = useState<any[]>([]);

    return (
        <div className="space-y-4">
            {/* === Chat history section === */}
            {/* Loop through all the messages in history and show them on screen */}
            <div className="space-y-2">
                {history.map((m, i) => (
                    <div 
                    key = {i} // key helps react to keep track of elements in a list
                    className={`${
                        m.role === "user" ? "text-right" : "text-left"}}"
                    } text-sm`} // If the message is from user, align right, else left
                    >
                        <div className="inline-block px-3 py-2 rounded bg-gray-200">
                            {/* Show message content, or name of function if its a function call */}
                            { m. content ?? m.function_call?.name ?? "Bot"}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* === Input box === */}
            {/*This is where the user types their message */}
            <input type="text"
            className="border border-gray-300 rounded 2-full p-2"
            placeholder="Type a message and press enter"
            value={msg} // This binds the input box to the msg stat
            onChange={(e) => setMsg(e.target.value)} // update msg when user types
            onKeyDown={(e) => e.key === "Enter" && send()} // if user press enter, call send()
            /> 
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

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {"content-Type": "application.json"},
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
                    context:"Something went wrong talking to the bot.",
                },
            ]);
        }
    }
}


// 1. You type something like "hi i want to move from 123 main st to 123 example ave"
// 2. The message isadded to the hitory state
// 3. the ui sends this to /Api/chat on the backend 
// 4. The backend detects a get_quota function call 
// 5. it returns the quote ($90 base + $2.62/min)
// 6. The response is added to the caht and shown as a bubble
