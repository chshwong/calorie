// Day completion celebration messages
// Messages are randomly selected when a day transitions from unknown to completed or fasted

export const DAY_COMPLETION_MESSAGES: string[] = [
  // TODO: Replace with actual celebration messages
  'Day complete. Every log today builds tomorrow\'s progress.',
  'Nice work closing the day. Consistency beats perfection.',
  'Logged, done, and dusted. Keep showing up.',
  'Another day tracked. Small wins add up.',
  'Day completed. You\'re building a strong habit.',
  'Well done. Today\'s effort counts.',
  'Closed out the day. Progress in motion.',
  'One more day logged. Stay steady.',
  'Day finished. Momentum maintained.',
  'Great job today. See you tomorrow.',
  'Logged and complete. Trust the process.',
  'Day wrapped up. You stayed accountable.',
  'Another checkmark. Consistency unlocked.',
  'Day complete. Discipline looks good on you.',
  'Solid work today. Keep the streak alive.',
  'Finished strong. Progress continues.',
  'Day logged. Future you says thanks.',
  'Nice finish. Habits in action.',
  'Done for today. One step closer.',
  'Logged and finished. Keep the rhythm.',
  'Another day done. Stay consistent.',
  'Day closed. Progress over time.',
  'Complete. Small actions, big results.',
  'Today logged. Momentum matters.',
  'Day finished. Keep moving forward.',
  'Logged today. That\'s how habits stick.',
  'Day complete. Strong follow-through.',
  'Done for the day. Well executed.',
  'Another day tracked. Stay the course.',
  'Complete. Effort recorded.',
  'Day wrapped. Consistency wins.',
  'Logged and done. One more rep for discipline.',
  'Finished today. Build on it tomorrow.',
  'Day complete. You\'re doing the work.',
  'Logged. Progress stays measurable.',
  'Another day down. Keep it simple.',
  'Day finished. Systems at work.',
  'Complete for today. Show up again tomorrow.',
];

export function pickRandomDayCompletionMessage(): string {
  const index = Math.floor(Math.random() * DAY_COMPLETION_MESSAGES.length);
  return DAY_COMPLETION_MESSAGES[index];
}

export const DAY_COMPLETION_WEIGHTLOSS_ONTARGET_LOWDEFICIT_MESSAGES: string[] = [
  'Goal reached. Excellent work.',
  "You hit today's goal.",
  'Daily target achieved.',
  'Goal complete. Nicely done.',
  "Today's goal: achieved.",
  'You met your daily goal.',
  'Target met. Great discipline.',
  'Goal achieved. Stay steady.',
  'Daily goal locked in.',
  "You nailed today's target.",
  'Goal complete. Momentum building.',
  "Today's target is done.",
  'Daily goal: check.',
  'You stayed on target today.',
  'Goal achieved. Well executed.',
  'Daily target cleared.',
  "You delivered on today's goal.",
  'Goal met. Progress continues.',
  "Today's goal accomplished.",
  'Daily target complete.',
  'Goal achieved. Keep going.',
  'You hit the mark today.',
  'Daily goal secured.',
  'Target achieved. Nice follow-through.',
  'Goal complete. On track.',
  "You reached today's goal.",
  'Daily goal satisfied.',
  'Goal achieved. Strong day.',
  "Today's target locked.",
  'Goal met. Consistency wins.',
];

export function pickRandomWeightLossOnTargetMessage(): string {
  const i = Math.floor(
    Math.random() * DAY_COMPLETION_WEIGHTLOSS_ONTARGET_LOWDEFICIT_MESSAGES.length
  );
  return DAY_COMPLETION_WEIGHTLOSS_ONTARGET_LOWDEFICIT_MESSAGES[i];
}
