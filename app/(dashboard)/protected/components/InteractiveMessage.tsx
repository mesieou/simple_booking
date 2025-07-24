import React from 'react';
import { BotResponseMessage } from '@/types/chat';

interface InteractiveMessageProps {
  content: BotResponseMessage;
}

const InteractiveMessage: React.FC<InteractiveMessageProps> = ({ content }) => {
  const hasButtons = content.buttons && content.buttons.length > 0;

  return (
    <div className="space-y-2">
      {/* Message Text */}
      {content.text && <p className="text-sm text-white">{content.text}</p>}

      {/* Section Title for Lists - ONLY show if there are buttons */}
      {hasButtons && content.listSectionTitle && (
        <div className="pt-1">
          <p className="text-xs font-semibold uppercase text-purple-300 tracking-wider">
            {content.listSectionTitle}
          </p>
        </div>
      )}

      {/* Buttons/List Items */}
      {hasButtons && (
        <div className="space-y-1.5 pt-1">
          {content.buttons?.map((button, index) => (
            <div key={index} className="bg-purple-600/50 p-2.5 rounded-md hover:bg-purple-600/80 transition-colors duration-150">
              <p className="text-sm font-medium text-white">{button.buttonText}</p>
              {button.buttonDescription && (
                <p className="text-xs text-purple-200 mt-0.5">{button.buttonDescription}</p>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* List Action Button has been removed as it is not needed in the admin view */}
    </div>
  );
};

export default InteractiveMessage; 