/**
 * Alert System for Customer Service
 * 
 * This module provides functionality to monitor user mood and trigger
 * alerts for administrators when intervention may be needed.
 */

import { MoodAnalysisResult } from '@/lib/helpers/openai/openai-helpers';

// In-memory store for user mood history
// In a production system, this would be stored in a database
interface UserMoodHistory {
  [userId: string]: {
    recentScores: MoodAnalysisResult[];
    lastAlertTime?: Date;
  };
}

// Configuration for alert triggers
interface AlertConfig {
  // Threshold score below which an alert might be triggered
  scoreThreshold: number;
  
  // Number of consecutive low scores needed to trigger an alert
  consecutiveLowScoresThreshold: number;
  
  // Minimum time between alerts for the same user (in minutes)
  cooldownPeriodMinutes: number;
}

// Default configuration
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  scoreThreshold: 4,
  consecutiveLowScoresThreshold: 2,
  cooldownPeriodMinutes: 30
};

// Store for user mood history
const userMoodHistory: UserMoodHistory = {};

/**
 * Process a new mood score and determine if an admin alert should be triggered
 * 
 * @param userId Unique identifier for the user
 * @param moodResult The mood analysis result
 * @param config Optional custom alert configuration
 * @returns Boolean indicating whether an admin alert was triggered
 */
export function processMoodAndCheckForAlert(
  userId: string,
  moodResult: MoodAnalysisResult,
  config: AlertConfig = DEFAULT_ALERT_CONFIG
): boolean {
  // Initialize user history if it doesn't exist
  if (!userMoodHistory[userId]) {
    userMoodHistory[userId] = {
      recentScores: []
    };
  }
  
  const userHistory = userMoodHistory[userId];
  
  // Add the new score to the user's history
  userHistory.recentScores.push(moodResult);
  
  // Keep only the most recent scores (last 5)
  if (userHistory.recentScores.length > 5) {
    userHistory.recentScores.shift();
  }
  
  // Check if an alert should be triggered
  const shouldTriggerAlert = checkAlertConditions(userId, config);
  
  if (shouldTriggerAlert) {
    // Record the alert time
    userHistory.lastAlertTime = new Date();
    
    // Log the alert (this would be replaced with actual admin notification)
    console.log(`[ADMIN ALERT] User ${userId} has shown frustration ${config.consecutiveLowScoresThreshold} times in a row.`);
    console.log(`[ADMIN ALERT] Latest mood: ${moodResult.score}/10 (${moodResult.category}: ${moodResult.description})`);
    console.log(`[ADMIN ALERT] Administrator intervention may be required.`);
    
    // In a real system, you would call an external service or send a notification here
    // For example: await sendAdminNotification(userId, userHistory.recentScores);
    
    return true;
  }
  
  return false;
}

/**
 * Check if alert conditions are met for a user
 * 
 * @param userId Unique identifier for the user
 * @param config Alert configuration
 * @returns Boolean indicating whether alert conditions are met
 */
function checkAlertConditions(userId: string, config: AlertConfig): boolean {
  const userHistory = userMoodHistory[userId];
  
  // Check if we're still in the cooldown period
  if (userHistory.lastAlertTime) {
    const timeSinceLastAlert = new Date().getTime() - userHistory.lastAlertTime.getTime();
    const cooldownPeriodMs = config.cooldownPeriodMinutes * 60 * 1000;
    
    if (timeSinceLastAlert < cooldownPeriodMs) {
      return false;
    }
  }
  
  // Check if we have enough recent scores to evaluate
  if (userHistory.recentScores.length < config.consecutiveLowScoresThreshold) {
    return false;
  }
  
  // Check the most recent scores
  const recentLowScores = userHistory.recentScores
    .slice(-config.consecutiveLowScoresThreshold)
    .filter(result => result.score < config.scoreThreshold);
  
  // Alert if we have enough consecutive low scores
  return recentLowScores.length >= config.consecutiveLowScoresThreshold;
}

/**
 * Reset a user's mood history
 * 
 * @param userId Unique identifier for the user
 */
export function resetUserMoodHistory(userId: string): void {
  if (userMoodHistory[userId]) {
    userMoodHistory[userId] = {
      recentScores: []
    };
  }
}

/**
 * Get a user's mood history
 * 
 * @param userId Unique identifier for the user
 * @returns The user's mood history or undefined if not found
 */
export function getUserMoodHistory(userId: string) {
  return userMoodHistory[userId];
}