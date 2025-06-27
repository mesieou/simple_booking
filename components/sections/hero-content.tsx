const HeroContent = () => {
  return (
    <div className="text-center lg:text-left">
      <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight md:leading-[1.2] mb-6">
        Let AI agents handle your{" "}
        <span className="text-foreground bg-primary/80 px-1 rounded-sm">
          bookings
        </span>{" "}
        and{" "}
        <span className="text-secondary bg-white px-1 rounded-sm">
          calendars
        </span>{" "}
        
      </h1>

      <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0">
        Your top source for business automation. Discover how our AI can streamline your operations and delight your customers.
      </p>
    </div>
  );
};

export default HeroContent; 