// This page will establish the fundamental layout for the chat page
// Desktop: Two columns: chat list and chat window, with sliding notifications panel from left edge
// Mobile: Tab-based navigation between chat list, chat window, and notifications

import React, { useState } from "react";
import { Button } from '@/components/ui/button';
import { Bell, ChevronLeft, Menu } from 'lucide-react';
import { RightMenuPanelProps } from './right-menu-panel';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"

type ChatLayoutProps = {
    notificationPanel: React.ReactNode;
    chatList: React.ReactNode;
    chatWindow: React.ReactNode;
    rightMenuPanel: React.ReactElement<RightMenuPanelProps>;
    selectedUserId?: string | null;
    hasNotifications?: boolean;
    isPanelOpen: boolean;
    setIsPanelOpen: (isOpen: boolean) => void;
    isMenuOpen: boolean;
    setIsMenuOpen: (isOpen: boolean) => void;
    onBack: () => void;
};

export function ChatLayout({
    notificationPanel,
    chatList,
    chatWindow,
    rightMenuPanel,
    selectedUserId,
    hasNotifications = false,
    isPanelOpen,
    setIsPanelOpen,
    isMenuOpen,
    setIsMenuOpen,
    onBack,
}: ChatLayoutProps) {
    const [activeTab, setActiveTab] = useState<'chats' | 'notifications' | 'menu'>('chats');

    // Clone the right menu panel to override onClose and hide the close button for mobile
    const mobileRightMenuPanel = React.cloneElement(rightMenuPanel, {
        onClose: () => setActiveTab('chats'),
        showCloseButton: false,
    });

    return (
        <div className="h-full w-full bg-slate-900/40 text-white">
            {/* ======================= Mobile View ======================= */}
            <div className="md:hidden flex flex-col h-full max-h-full overflow-hidden">
                {selectedUserId ? (
                    // If a user is selected, show only the chat window
                    <div className="h-full w-full flex flex-col">{chatWindow}</div>
                ) : (
                    // Otherwise, show the tabbed view for Chats, Notifications, and Menu
                    <div className="flex flex-col h-full max-h-full overflow-hidden p-2">
                        {/* Mobile Tab Navigation */}
                        <div className="flex-shrink-0 bg-slate-800/60 border-b border-white/10 rounded-t-lg">
                            <nav className="flex">
                                <button
                                    onClick={() => setActiveTab('chats')}
                                    className={`flex-1 py-2.5 px-2 text-xs font-medium text-center border-b-2 transition-colors rounded-tl-lg ${activeTab === 'chats'
                                        ? 'border-purple-500 text-purple-400 bg-purple-900/20'
                                        : 'border-transparent text-gray-400 hover:text-gray-300'
                                    }`}
                                >
                                    Chats
                                </button>
                                <button
                                    onClick={() => setActiveTab('notifications')}
                                    className={`flex-1 py-2.5 px-2 text-xs font-medium text-center border-b-2 transition-colors relative ${activeTab === 'notifications'
                                        ? 'border-purple-500 text-purple-400 bg-purple-900/20'
                                        : 'border-transparent text-gray-400 hover:text-gray-300'
                                    }`}
                                >
                                    Alerts
                                    {hasNotifications && (
                                        <div className="absolute top-2 right-6 w-2 h-2 bg-red-500 rounded-full"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('menu')}
                                    className={`flex-1 py-2.5 px-2 text-xs font-medium text-center border-b-2 transition-colors rounded-tr-lg ${activeTab === 'menu'
                                        ? 'border-purple-500 text-purple-400 bg-purple-900/20'
                                        : 'border-transparent text-gray-400 hover:text-gray-300'
                                    }`}
                                >
                                    <Menu className="h-5 w-5 mx-auto"/>
                                </button>
                            </nav>
                        </div>
                        {/* Mobile Content Area */}
                        <div className="flex-1 min-h-0 overflow-hidden bg-slate-800/30 border-x border-b border-white/10 rounded-b-lg">
                            <div className={`${activeTab === 'chats' ? 'h-full' : 'hidden'}`}>{chatList}</div>
                            <div className={`${activeTab === 'notifications' ? 'h-full' : 'hidden'}`}>{notificationPanel}</div>
                            <div className={`${activeTab === 'menu' ? 'h-full' : 'hidden'}`}>{mobileRightMenuPanel}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* ======================= Desktop View ======================= */}
            <div className="hidden md:flex h-full w-full relative overflow-hidden">
                <aside
                    className={`absolute top-0 left-0 h-full z-20 bg-slate-900/80 backdrop-blur-sm transition-all duration-300 ease-in-out ${
                        isPanelOpen ? 'w-[320px]' : 'w-0'
                    } overflow-hidden`}
                >
                    <div className="p-4 h-full">{notificationPanel}</div>
                </aside>

                {/* Panel Toggle Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className={`absolute top-1/2 -translate-y-1/2 h-20 w-10 flex items-center justify-center 
                               bg-transparent z-30 transition-all duration-300 ease-in-out rounded-l-none group
                               hover:bg-white/10 border-y border-r border-white/10
                               ${isPanelOpen
                                 ? 'left-[320px] rounded-r-md'
                                 : 'left-0 rounded-r-lg'
                               }`}
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                >
                    {isPanelOpen
                        ? <ChevronLeft className="h-8 w-8 text-gray-400 group-hover:text-white" />
                        : <Bell className="h-8 w-8 text-gray-400 group-hover:text-white" />}
                </Button>

                <div
                    className={`flex-1 h-full transition-all duration-300 ease-in-out ${
                        isPanelOpen ? 'ml-[320px]' : 'ml-0'
                    }`}
                >
                    <div className="flex h-full w-full">
                        <ResizablePanelGroup 
                            direction="horizontal" 
                            className="flex-1"
                        >
                            <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                                <div className="p-1 h-full max-h-full">
                                    <main className="h-full max-h-full bg-slate-900/40 rounded-lg border border-white/10">
                                        {chatList}
                                    </main>
                                </div>
                            </ResizablePanel>
                            <ResizableHandle withHandle className="bg-transparent" />
                            <ResizablePanel defaultSize={70} minSize={30}>
                                <div className="p-1 h-full max-h-full">
                                    <section className="h-full max-h-full min-w-0 bg-slate-900/40 rounded-lg border border-white/10 overflow-hidden">
                                        {chatWindow}
                                    </section>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                        {/* Right Menu Panel */}
                        <aside className={`fixed top-0 right-0 h-screen bg-slate-900/90 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden z-50 ${isMenuOpen ? 'w-[300px]' : 'w-0'}`}>
                            <div className="w-[300px] h-full">
                                {rightMenuPanel}
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    )
}