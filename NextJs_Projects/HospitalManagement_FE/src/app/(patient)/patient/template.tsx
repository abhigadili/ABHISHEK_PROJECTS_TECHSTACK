/** Template: re-mounted on every navigation inside /patient (layouts persist; templates reset) - replays the entrance animation. */
export default function Template({ children }: { children: React.ReactNode }) { return <div className="animate-[fade-in_.25s_ease-out]">{children}</div>; }
