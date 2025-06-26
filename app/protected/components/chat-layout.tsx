// This page will establish the fundamental layout for the chat page
// Two columns: chat list and chat window, with sliding notifications panel from left edge

import React, { useState } from "react";

type ChatLayoutProps = {
    notificationPanel: React.ReactNode;
    chatList: React.ReactNode;
    chatWindow: React.ReactNode;
};

export function ChatLayout({ notificationPanel, chatList, chatWindow}: ChatLayoutProps) {
    const [isNotificationPanelVisible, setIsNotificationPanelVisible] = useState(false);

    return (
        <div className="flex h-full max-h-full gap-4 rounded-lg bg-slate-900/40 text-white overflow-hidden p-6 relative">
            {/* Floating bell button - protrudes from left edge */}
            <button
                onClick={() => setIsNotificationPanelVisible(!isNotificationPanelVisible)}
                className={`fixed top-1/2 -translate-y-1/2 z-50 p-3 bg-slate-700 hover:bg-slate-600 rounded-r-lg border-r border-t border-b border-white/10 transition-all duration-300 shadow-lg ${
                    isNotificationPanelVisible ? 'left-80' : 'left-0'
                }`}
                title="Toggle Notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            </button>

            {/* Backdrop/overlay - only shows when panel is open */}
            {isNotificationPanelVisible && (
                <div 
                    className="fixed inset-0 bg-black/30 z-30 transition-opacity duration-300"
                    onClick={() => setIsNotificationPanelVisible(false)}
                ></div>
            )}
            
            {/* Sliding notifications panel */}
            <div className={`fixed top-0 left-0 h-full w-80 bg-slate-800/95 backdrop-blur-sm border-r border-white/20 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
                isNotificationPanelVisible ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Close button inside panel */}
                <div className="absolute top-4 right-4 z-50">
                    <button
                        onClick={() => setIsNotificationPanelVisible(false)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full border border-white/10 transition-colors"
                        title="Close Notifications"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Notifications content */}
                <div className="h-full pt-2">
                    {notificationPanel}
                </div>
            </div>
            
            {/* Chat list - wider fixed width */}
            <div className="w-96 h-full max-h-full bg-slate-800/30 rounded-lg border border-white/10 overflow-hidden">
                {chatList}
            </div>
            
            {/* Chat window - takes remaining space */}
            <div className="flex-1 h-full max-h-full bg-slate-800/30 rounded-lg border border-white/10 overflow-hidden">
                {chatWindow}
            </div>
        </div>
    )
}