import "./globals.css";

export const metadata = {
  title: "Visual Judy™ Prototype",
  description: "JudyVA-compatible conversational avatar prototype"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
