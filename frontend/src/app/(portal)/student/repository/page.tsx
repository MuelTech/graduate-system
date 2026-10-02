"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepositoryBrowser } from "@/components/repository/repository-browser";

export default function StudentRepositoryPage() {
  return (
    <RepositoryBrowser
      title="Research Repository"
      description="Browse the same published research metadata available to the public."
      headerAction={
        <Link href="/student/repository/submit">
          <Button className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
            <Upload className="mr-2 h-4 w-4" />
            Databank Archive
          </Button>
        </Link>
      }
    />
  );
}
