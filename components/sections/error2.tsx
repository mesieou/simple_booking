"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const Svg404 = () => (
  <svg viewBox="0 0 800 300" className="w-full max-w-xl h-auto">
    {/* Trails left */}
    <motion.g
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
    >
      <rect x="180" y="110" width="40" height="12" fill="#34A853" rx="6" />
      <rect x="150" y="130" width="20" height="12" fill="#FBBC05" rx="6" />
      <rect x="210" y="145" width="30" height="12" fill="#EA4335" rx="6" />
      <rect x="160" y="80" width="50" height="12" fill="#4285F4" rx="6" />
    </motion.g>

    {/* 4 */}
    <motion.text
      x="250"
      y="200"
      fontFamily="sans-serif"
      fontSize="200"
      fontWeight="bold"
      textAnchor="middle"
      fill="hsl(var(--foreground))"
      style={{ fill: "var(--fill-color)" }}
      initial={{ y: 50, opacity: 0, "--fill-color": "hsl(var(--foreground))" }}
      animate={{
        y: 0,
        opacity: 1,
        "--fill-color": [
          "hsl(var(--foreground))",
          "hsl(var(--primary))",
          "hsl(var(--foreground))",
        ],
      }}
      transition={{
        y: { type: "spring", stiffness: 100 },
        opacity: { type: "spring", stiffness: 100 },
        "--fill-color": {
          duration: 2,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        },
      }}
    >
      4
    </motion.text>

    {/* 0 */}
    <motion.text
      x="400"
      y="200"
      fontFamily="sans-serif"
      fontSize="200"
      fontWeight="bold"
      textAnchor="middle"
      fill="hsl(var(--foreground))"
      style={{ fill: "var(--fill-color)" }}
      initial={{ y: 50, opacity: 0, "--fill-color": "hsl(var(--foreground))" }}
      animate={{
        y: 0,
        opacity: 1,
        "--fill-color": [
          "hsl(var(--foreground))",
          "hsl(var(--primary))",
          "hsl(var(--foreground))",
        ],
      }}
      transition={{
        y: { type: "spring", stiffness: 100 },
        opacity: { type: "spring", stiffness: 100, delay: 0.1 },
        "--fill-color": {
          duration: 2,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
          delay: 0.3,
        },
      }}
    >
      0
    </motion.text>

    {/* 4 */}
    <motion.text
      x="550"
      y="200"
      fontFamily="sans-serif"
      fontSize="200"
      fontWeight="bold"
      textAnchor="middle"
      fill="hsl(var(--foreground))"
      style={{ fill: "var(--fill-color)" }}
      initial={{ y: 50, opacity: 0, "--fill-color": "hsl(var(--foreground))" }}
      animate={{
        y: 0,
        opacity: 1,
        "--fill-color": [
          "hsl(var(--foreground))",
          "hsl(var(--primary))",
          "hsl(var(--foreground))",
        ],
      }}
      transition={{
        y: { type: "spring", stiffness: 100 },
        opacity: { type: "spring", stiffness: 100, delay: 0.2 },
        "--fill-color": {
          duration: 2,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
          delay: 0.6,
        },
      }}
    >
      4
    </motion.text>

    {/* Trails right */}
    <motion.g
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
    >
      <rect x="580" y="100" width="60" height="12" fill="#34A853" rx="6" />
      <rect x="620" y="120" width="30" height="12" fill="#FBBC05" rx="6" />
      <rect x="590" y="140" width="20" height="12" fill="#EA4335" rx="6" />
      <rect x="640" y="70" width="40" height="12" fill="#4285F4" rx="6" />
    </motion.g>
  </svg>
);

export function ErrorSection2() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-foreground p-8">
      <div className="w-full max-w-2xl flex flex-col items-center text-center">
        <Svg404 />
        <h1 className="text-3xl font-bold mt-8 mb-4">Something is wrong</h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for was moved, removed, renamed or might
          never existed!
        </p>
        <Link href="/">
          <Button
            variant="default"
            size="icon"
            className="rounded-full w-16 h-16 bg-foreground text-background hover:bg-foreground/80"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
