import { PhoneCall } from "lucide-react";

const DemoCallButton = () => {
  const handleClick = () => {
    // Handle demo call - could open a modal or redirect to booking
    console.log("Demo call requested");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-3 px-8 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-primary to-secondary shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition hover:scale-105"
      aria-label="Try Demo Call"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span className="relative flex items-center justify-center">
        <span className="absolute w-10 h-10 rounded-full bg-white/20 animate-ping" />
        <PhoneCall className="relative z-10 w-6 h-6" />
      </span>
      Try Demo Call
    </button>
  );
};

export default DemoCallButton;
