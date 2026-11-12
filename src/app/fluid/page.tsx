import type { Metadata } from "next";
import { FluidStudio } from "@/components/fluid/FluidStudio";

export const metadata: Metadata = {
  title: "Undertow — a GPU fluid simulation",
  description:
    "A real-time Navier–Stokes solver running in WebGL2, where editable typography is a solid obstacle the fluid flows around.",
};

export default function Page() {
  return <FluidStudio />;
}
