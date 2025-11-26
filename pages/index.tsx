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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Cabin Trivia</h1>
        <p className="text-gray-600">Redirecting to mode selection...</p>
      </div>
    </div>
  );
}

