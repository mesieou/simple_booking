// This page will establish the fundamental layout for the chat page
// Desktop: Two columns: chat list and chat window, with sliding notifications panel from left edge
// Mobile: Tab-based navigation between chat list, chat window, and notifications

import React, { useState } from "react";

type ChatLayoutProps = {
    notificationPanel: React.ReactNode;
    chatList: React.ReactNode;
    chatWindow: React.ReactNode;
    selectedUserId?: string | null;
    hasNotifications?: boolean;
};

export function ChatLayout({ 
    notificationPanel, 
    chatList, 
    chatWindow, 
    selectedUserId,
    hasNotifications = false 
}: ChatLayoutProps) {
    const [isNotificationPanelVisible, setIsNotificationPanelVisible] = useState(false);
    // Mobile tab state: 'chats' | 'chat' | 'notifications'
    const [activeTab, setActiveTab] = useState<'chats' | 'chat' | 'notifications'>('chats');

    // Auto-switch to chat tab on mobile when a chat is selected
    React.useEffect(() => {
        if (selectedUserId && window.innerWidth < 768) {
            setActiveTab('chat');
        }
    }, [selectedUserId]);

    return (
        <>
            {/* Desktop Layout - Hidden on mobile */}
            <div className="hidden md:flex h-full max-h-full gap-4 rounded-lg bg-slate-900/40 text-white overflow-hidden p-6 relative">
                {/* Desktop Floating bell button - protrudes from left edge */}
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
                    {hasNotifications && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                    )}
                </button>

                {/* Desktop Backdrop/overlay - only shows when panel is open */}
                {isNotificationPanelVisible && (
                    <div 
                        className="fixed inset-0 bg-black/30 z-30 transition-opacity duration-300"
                        onClick={() => setIsNotificationPanelVisible(false)}
                    ></div>
                )}
                
                {/* Desktop Sliding notifications panel */}
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
                
                {/* Desktop Chat list - wider fixed width */}
                <div className="w-96 h-full max-h-full bg-slate-800/30 rounded-lg border border-white/10 overflow-hidden">
                    {chatList}
                </div>
                
                {/* Desktop Chat window - takes remaining space */}
                <div className="flex-1 h-full max-h-full bg-slate-800/30 rounded-lg border border-white/10 overflow-hidden">
                    {chatWindow}
                </div>
            </div>

            {/* Mobile Layout - Hidden on desktop */}
            <div className="md:hidden flex flex-col h-full max-h-full bg-slate-900/40 text-white overflow-hidden">
                {/* Mobile Tab Navigation */}
                <div className="flex-shrink-0 bg-slate-800/60 border-b border-white/10">
                    <nav className="flex">
                        {/* Chats Tab */}
                        <button
                            onClick={() => setActiveTab('chats')}
                            className={`flex-1 py-4 px-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                activeTab === 'chats'
                                    ? 'border-purple-500 text-purple-400 bg-purple-900/20'
                                    : 'border-transparent text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span>Chats</span>
                            </div>
                        </button>

                        {/* Chat Tab */}
                        <button
                            onClick={() => setActiveTab('chat')}
                            disabled={!selectedUserId}
                            className={`flex-1 py-4 px-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                activeTab === 'chat'
                                    ? 'border-purple-500 text-purple-400 bg-purple-900/20'
                                    : selectedUserId 
                                        ? 'border-transparent text-gray-400 hover:text-gray-300'
                                        : 'border-transparent text-gray-600 cursor-not-allowed'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h2m-5 8v2a2 2 0 002 2h6l4 4v-6a2 2 0 00-2-2H11a2 2 0 01-2-2z" />
                                </svg>
                                <span>Chat</span>
                            </div>
                        </button>

                        {/* Notifications Tab */}
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 py-4 px-3 text-sm font-medium text-center border-b-2 transition-colors relative ${
                                activeTab === 'notifications'
                                    ? 'border-purple-500 text-purple-400 bg-purple-900/20'
                                    : 'border-transparent text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <span>Alerts</span>
                                {hasNotifications && (
                                    <div className="absolute top-2 right-6 w-2 h-2 bg-red-500 rounded-full"></div>
                                )}
                            </div>
                        </button>
                    </nav>
                </div>

                {/* Mobile Content Area */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {/* Chats Content */}
                    {activeTab === 'chats' && (
                        <div className="h-full bg-slate-800/30 border border-white/10 rounded-lg m-3 overflow-hidden">
                            {chatList}
                        </div>
                    )}

                    {/* Chat Content */}
                    {activeTab === 'chat' && (
                        <div className="h-full bg-slate-800/30 border border-white/10 rounded-lg m-3 overflow-hidden">
                            {chatWindow}
                        </div>
                    )}

                    {/* Notifications Content */}
                    {activeTab === 'notifications' && (
                        <div className="h-full bg-slate-800/30 border border-white/10 rounded-lg m-3 overflow-hidden">
                            {notificationPanel}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}