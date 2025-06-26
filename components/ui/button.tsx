import * as React from "react"; // React core library
import { Slot } from "@radix-ui/react-slot"; // For flexible component rendering
import { cva, type VariantProps } from "class-variance-authority"; // For creating variant classes
import { cn } from "@/lib/utils";


// Define button variants using class-variance-authority (cva)
const buttonVariants = cva(
  // Base classes that apply to all buttons
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    // Variant definitions - different visual styles for the button
    variants: {
      variant: {
        // Primary button with gradient from primary to secondary color
        default: "bg-gradient-to-r from-primary to-secondary border border-border text-primary-foreground hover:bg-gradient-to-r hover:from-secondary hover:to-primary",
        
        // Destructive button (for dangerous actions)
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        
        // Outline button with border
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        
        // Secondary button with reverse gradient
        secondary: "text-secondary-foreground border border-border",
        
        // Ghost button (minimal styling)
        ghost: "hover:bg-accent hover:text-accent-foreground",
        
        // Link button (looks like text link)
        link: "text-primary underline-offset-4 hover:underline",
      },
      
      // Size variants
      size: {
        default: "h-10 px-4 py-2", // Default size
        sm: "h-9 rounded-md px-3", // Small size
        lg: "h-11 rounded-md px-8", // Large size
        icon: "h-10 w-10", // Square icon button
      },
    },
    
    // Default variants if none are specified
    defaultVariants: {
      variant: "default", // Uses the 'default' variant by default
      size: "default",   // Uses the 'default' size by default
    },
  }
);

// Define the Button component's prop types
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, // Standard button HTML attributes
    VariantProps<typeof buttonVariants> { // Variant props from our buttonVariants
  asChild?: boolean; // Optional prop to render as child component
}

// Create the Button component using React.forwardRef
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Use Slot component if asChild is true, otherwise use regular button
    const Comp = asChild ? Slot : "button";
    
    return (
      // Render the component with combined class names
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }) // Apply variant classes
        )}
        ref={ref} // Forward the ref
        {...props} // Spread all other props
      />
    );
  }
);

// Set display name for debugging purposes
Button.displayName = "Button";

// Export the Button component and variants for reuse
export { Button, buttonVariants };