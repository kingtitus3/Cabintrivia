// pages/index.tsx

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to mode selection page
    router.push("/mode");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
      <div className="cabin-panel px-8 py-8 text-center max-w-md w-full">
        <div className="text-4xl mb-4">🏕️</div>
        <h1 className="text-2xl font-bold mb-2 text-slate-100">Cabin Trivia</h1>
        <p className="text-slate-400">Redirecting to mode selection...</p>
      </div>
    </div>
  );
}

