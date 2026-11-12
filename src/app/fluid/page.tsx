import type { Metadata } from "next";
import { FluidStudio } from "@/components/fluid/FluidStudio";

const title = "Undertow — a GPU fluid simulation";
const description =
  "A real-time Navier–Stokes solver running in WebGL2, where editable typography is a solid obstacle the fluid flows around.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
};

export default function Page() {
  return <FluidStudio />;
}
