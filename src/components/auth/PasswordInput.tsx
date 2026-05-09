"use client";

import { forwardRef, useState } from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ error, className, ...props }, ref) {
    const [show, setShow] = useState(false);

    const baseClasses =
      "w-full rounded-xl border px-4 py-3 pr-11 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:outline-none focus:ring-4 dark:text-zinc-100 dark:placeholder:text-zinc-600";
    const normalClasses =
      "border-zinc-200 bg-white focus:border-blue-500 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";
    const errorClasses =
      "border-red-300 bg-white focus:border-red-400 focus:ring-red-400/10 dark:border-red-700 dark:bg-zinc-800 dark:focus:border-red-500 dark:focus:ring-red-500/10";

    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={[baseClasses, error ? errorClasses : normalClasses, className ?? ""]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
export default PasswordInput;

function Eye() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}
