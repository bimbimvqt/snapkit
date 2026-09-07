import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) return fail(error.issues[0]?.message ?? "Dữ liệu không hợp lệ", 422, "VALIDATION_ERROR");
  if (error instanceof SyntaxError) return fail("Nội dung JSON không hợp lệ", 400, "INVALID_JSON");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return fail("Dữ liệu đã tồn tại hoặc xung đột với yêu cầu khác", 409, "CONFLICT");
  }
  console.error(error);
  return fail("Đã có lỗi hệ thống. Vui lòng thử lại.", 500, "INTERNAL_ERROR");
}
