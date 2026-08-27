import type { Metadata } from "next";
import { LoginForm } from "./login-form";
export const metadata: Metadata = { title: "Đăng nhập quản trị" };
export default function LoginPage() { return <main className="grid min-h-screen place-items-center px-5 py-12"><LoginForm /></main>; }
