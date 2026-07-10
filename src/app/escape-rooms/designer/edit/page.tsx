"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Designer from "../../Designer";
import LoadingSpinner from "@/components/LoadingSpinner";

function EscapeRoomDesignerEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [loading, setLoading] = useState(!!id);
  const [initialData, setInitialData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/escape-rooms/designer/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInitialData(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load escape room");
        setLoading(false);
      });
  }, [id]);

  if (!id) return <div className="max-w-xl mx-auto py-8">Missing escape room id.</div>;
  if (loading) return <LoadingSpinner size={180} />;
  if (error) return <div className="max-w-xl mx-auto py-8 text-red-600">{error}</div>;

  return <Designer initialData={initialData} editId={id} />;
}

export default function EscapeRoomDesignerEditPage() {
  return (
    <Suspense fallback={<LoadingSpinner size={180} />}>
      <EscapeRoomDesignerEditPageContent />
    </Suspense>
  );
}
