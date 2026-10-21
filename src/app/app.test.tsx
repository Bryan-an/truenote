import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app";

describe("App", () => {
  it("renders the app name", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "truenote" }),
    ).toBeInTheDocument();
  });
});
