import React from "react";
import RoomClient from "./RoomClient";

export function generateStaticParams() {
  return [{ room: "connect" }];
}

interface RoomPageProps {
  params: Promise<{ room: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const resolvedParams = await params;
  return <RoomClient initialRoom={resolvedParams?.room || "connect"} />;
}
