import { redirect } from "next/navigation";

// O app fica em /coop.
export default function Inicio() {
  redirect("/coop");
}
