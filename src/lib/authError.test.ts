import { describe, expect, it } from "vitest";
import { describeAuthError } from "./authError";

describe("auth error messages", () => {
  it("explains a rejected email instead of blaming the connection", () => {
    expect(describeAuthError('Email address "test@synthetic.invalid" is invalid'))
      .toContain("endereço de email não foi aceito");
  });

  it("keeps actionable guidance for invalid credentials", () => {
    expect(describeAuthError("Invalid login credentials"))
      .toContain("Email ou senha incorretos");
  });
});
