import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) return fail(error.issues[0]?.message ?? "Dữ liệu không hợp lệ", 422, "VALIDATION_ERROR");
  console.error(error);
  return fail("Đã có lỗi hệ thống. Vui lòng thử lại.", 500, "INTERNAL_ERROR");
}

