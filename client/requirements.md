## Packages
recharts | For visualizing energy mix and savings data
framer-motion | Smooth page transitions and UI animations
lucide-react | Beautiful icons for the interface
date-fns | Formatting dates for history and logs
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind classes efficiently

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
}

Integration assumptions:
- AI Assistant uses POST /api/conversations/:id/messages with SSE for streaming responses
- Optimization endpoint uses POST /api/optimize
- Calculator history uses GET /api/history
