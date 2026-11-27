import { Inter } from "next/font/google";
import localFont from "next/font/local";
/** next/font: Google variable font (self-hosted, subsetted, display swap) + a local font for MRNs / codes / numbers. */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const monoLocal = localFont({
    src: "../fonts/DejaVuSansMono.ttf",
    variable: "--font-mono-local",
    display: "swap",
    weight: "400",
});
