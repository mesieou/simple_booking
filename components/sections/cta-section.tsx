import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CTASectionProps {
  title?: string;
  description?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  className?: string;
}

export const CTASection = ({
  title = "Ready to transform your business?",
  description = "Join thousands of companies that are already using AI agents to automate processes and accelerate their growth.",
  buttonText = "Get Started Now",
  onButtonClick,
  className = ""
}: CTASectionProps) => {
  const handleClick = () => {
    if (onButtonClick) {
      onButtonClick();
    } else {
      console.log('Get started clicked');
    }
  };

  return (
    <div className={`text-center mt-20 ${className}`}>
      <Card className="bg-[#f8f1f8] border-primary/20 max-w-2xl mx-auto aspect-square flex items-center justify-center">
        <CardContent className="p-12 text-center">
          <h3 className="text-3xl font-bold mb-6 text-gray-900">
            {title}
          </h3>
          <p className="text-gray-600 mb-8 text-lg leading-relaxed">
            {description}
          </p>
          <Button 
            onClick={handleClick}
            className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white px-10 py-4 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 text-lg"
          >
            {buttonText}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}; 