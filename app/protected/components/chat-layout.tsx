// This page will establish the fundamental layout for the chat page
// Left column the side bar with the list of active chats
// Right column is the main area to display messages from the chat selected

import React from "react";

type ChatLayoutProps = {
    chatList: React.ReactNode;
    chatWindow: React.ReactNode;
};

export function ChatLayout({ chatList, chatWindow}: ChatLayoutProps) {
    return (
        <div className="flex h-full rounded-lg bg-slate-900/40 text-white overflow-hidden">
            <div className="w-1/3 border-r border-white/10 h-full">
                {chatList}
            </div>
            <div className="w-2/3 flex flex-col h-full">
                {chatWindow}
            </div>
        </div>
    )
}