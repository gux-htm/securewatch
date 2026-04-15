import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("glass-panel rounded-2xl overflow-hidden transition-all duration-300", className)}>
    {children}
  </div>
);

export const CardHeader = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("px-6 py-4 border-b border-border/50 bg-secondary/20", className)}>
    {children}
  </div>
);

export const CardTitle = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <h3 className={cn("text-xl font-display font-semibold text-foreground glow-text", className)}>
    {children}
  </h3>
);

export const CardContent = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-6", className)}>
    {children}
  </div>
);

export const Badge = ({ children, variant = "default", className }: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "outline" | "secondary";
  className?: string;
}) => {
  const variants: Record<string, string> = {
    default: "bg-primary/20 text-primary border-primary/30",
    success: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    destructive: "bg-destructive/20 text-destructive border-destructive/30",
    outline: "bg-transparent text-muted-foreground border-border",
    secondary: "bg-secondary/40 text-secondary-foreground border-secondary/30",
  };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm", variants[variant], className)}>
      {children}
    </span>
  );
};

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}>(
  ({ className, variant = "primary", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "bg-transparent border border-border hover:bg-secondary text-foreground",
      ghost: "bg-transparent hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
    };
    const sizes = {
      default: "px-4 py-2 text-sm",
      sm: "px-3 py-1.5 text-xs",
      lg: "px-6 py-3 text-base",
      icon: "p-2 w-9 h-9",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg glass-panel rounded-2xl shadow-2xl border border-primary/20 overflow-hidden z-10"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/30">
              <h2 className="text-lg font-display font-bold glow-text">{title}</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
