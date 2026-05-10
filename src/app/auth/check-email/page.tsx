import { Suspense } from "react";
import CheckEmailForm from "@/components/auth/CheckEmailForm";

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailForm />
    </Suspense>
  );
}
