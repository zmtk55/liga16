import { useParams } from "react-router";
import LegalPage from "./page";

export default function LegalRoute() {
  const { slug }: { slug?: string } = useParams();
  return <LegalPage slug={slug ?? "privacidad"} />;
}
