const HeroContent = () => {
  return (
    <div className="text-center lg:text-left">
      <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-relaxed mb-6">
        We help mobile business to manage their{" "}
        <span className="text-foreground bg-primary/80 px-1 rounded-sm">
          bookings
        </span>{" "}
        and{" "}
        <span className="text-secondary bg-white px-1 rounded-sm">
          calendars
        </span>{" "}
        with AI agents
      </h1>

      <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0">
        Your top source for business automation. Discover how our AI can streamline your operations and delight your customers.
      </p>

      <button
        className="group px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex items-center justify-center mx-auto lg:mx-0 gap-2"
        tabIndex={0}
        aria-label="Empezar ahora"
      >
        Get started now
        <svg 
          className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  );
};

export default HeroContent; 