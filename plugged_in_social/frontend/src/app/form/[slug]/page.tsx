import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PublicForm, {
  type PublicFormDefinition,
} from "@/components/PublicForm";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function loadForm(slug: string): Promise<PublicFormDefinition | null> {
  const response = await fetch(
    `${API_URL}/api/forms/public/${encodeURIComponent(slug)}`,
    { next: { revalidate: 60 } }
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Could not load form ${slug}: ${response.status}`);
  }
  return response.json();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = await loadForm(slug);
  if (!form) return { title: "Form not found", robots: { index: false } };
  return {
    title: form.name,
    description: form.description || `Submit ${form.name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function FormPage({ params }: PageProps) {
  const { slug } = await params;
  const form = await loadForm(slug);
  if (!form) notFound();

  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24 px-6 min-h-[calc(100vh-4rem)]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
              Form
            </div>
            <h1 className="heading-brand text-4xl md:text-5xl mb-5">
              {form.name}
            </h1>
            {form.description && (
              <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {form.description}
              </p>
            )}
          </div>
          <div className="bg-white border border-border rounded-2xl p-6 md:p-8 shadow-sm">
            <PublicForm form={form} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
