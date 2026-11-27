/**
 * Template: unlike a layout it is RE-MOUNTED on every navigation between its children, so the CSS entrance animation replays
 * and any per-page client state inside it resets. (Layouts persist and keep state.)
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-[fade-in_.25s_ease-out]">{children}</div>;
}
