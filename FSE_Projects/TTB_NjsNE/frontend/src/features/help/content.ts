/** Static help copy (not business data). Keys form the URL: /help/<section>/<topic>. */
export interface HelpTopic { slug: string; title: string; body: string }
export interface HelpSection { slug: string; title: string; topics: HelpTopic[] }
export const HELP: HelpSection[] = [
  { slug: 'booking', title: 'Booking tickets', topics: [
    { slug: 'search', title: 'How do I search for trains?', body: 'Choose a source, a destination and a travel date on the home page. Results show departure/arrival times, the classes that still have seats, and the fare for your exact journey segment.' },
    { slug: 'seats', title: 'Can I pick my seats?', body: 'Yes. After choosing a class, select exactly one seat per passenger on the seat map, or skip the map and we allocate the best available seats together.' },
    { slug: 'hold', title: 'How long are seats held?', body: 'Seats are held for 10 minutes after you reserve while you complete payment. A countdown on the payment page shows the remaining time.' } ] },
  { slug: 'payments', title: 'Payments & refunds', topics: [
    { slug: 'methods', title: 'Which payment methods work?', body: 'Card, UPI, net banking and wallet are available through a simulated gateway. No real money moves and card numbers are never stored - only the last four digits.' },
    { slug: 'cancel', title: 'How are cancellation charges decided?', body: 'The charge depends on how long before departure you cancel. The exact percentage and your refund are shown before you confirm the cancellation.' } ] },
];
export const findSection = (s?: string) => HELP.find((x) => x.slug === s);
export const findTopic = (s?: string, t?: string) => findSection(s)?.topics.find((x) => x.slug === t);
