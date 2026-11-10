// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "./App";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const panel = (name: RegExp) => within(screen.getByRole("region", { name }));

describe("App on DADF♯Ae in D major", () => {
  test("every key panel shows content", () => {
    render(<App />);

    const board = panel(/^Fretboard$/);
    expect(board.getByText(/DADF♯Ae, D major/)).toBeTruthy();
    expect(board.getAllByRole("button", { name: /tonic/ }).length).toBeGreaterThan(5);

    const fits = panel(/Best keys for this tuning/);
    expect(fits.getAllByRole("button")[0]!.textContent).toContain("D major");
    expect(fits.getByText("6/6 open strings in key, 5 in the tonic chord, low string is the root")).toBeTruthy();

    const chords = panel(/Chords in D major/);
    expect(chords.getByRole("button", { name: "Bm", pressed: false })).toBeTruthy();
    expect(chords.getByText("vi")).toBeTruthy();

    const voicings = panel(/Voicings for D/);
    expect(voicings.getAllByRole("button").length).toBeGreaterThan(3);

    const prog = panel(/^Progressions/);
    expect(prog.getAllByRole("listitem").map((li) => li.querySelector("header")?.textContent)).toEqual([
      "ID", "VA", "viBm", "IVG",
    ]);
    expect(prog.getByRole("button", { name: "Play loop" })).toBeTruthy();

    expect(panel(/^Capo$/).getByText("No capo, so the open strings sound as tuned.")).toBeTruthy();
  });

  test("picking the Dadd9 chip shows the all-open voicing with its badge", () => {
    render(<App />);
    fireEvent.click(panel(/Chords in D major/).getByRole("button", { name: "Dadd9" }));
    const voicings = panel(/Voicings for Dadd9/);
    expect(voicings.getAllByText("6 open strings ring").length).toBeGreaterThan(0);
    expect(voicings.getAllByText("0 0 0 0 0 0").length).toBeGreaterThan(0);
  });

  test("raising the capo with the sound held shows the shape name and the capo sentence", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Capo up one fret" }));
    fireEvent.click(screen.getByRole("button", { name: "Capo up one fret" }));
    expect(panel(/^Capo$/).getByText(/Capo 2 raises every open string 2 semitones/)).toBeTruthy();
    expect(panel(/Chords in D major/).getAllByText("C shape").length).toBeGreaterThan(0);
  });

  test("a bad custom tuning shows an inline error and keeps the old tuning", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Tuning/ }));
    const input = screen.getByLabelText(/Custom, low string first/);
    fireEvent.change(input, { target: { value: "D A H G" } });
    expect(screen.getByRole("alert").textContent).toContain('"H" is not a note');
    expect(panel(/^Fretboard$/).getByText(/DADF♯Ae/)).toBeTruthy();
  });

  test("a progression loaded from a template replaces the steps", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Minor shuttle" }));
    const steps = panel(/^Progressions/).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[1]!.querySelector("header")!.textContent).toContain("♭VII");
  });
});

describe("Setup toolbar", () => {
  const pill = (name: RegExp) => within(screen.getByRole("region", { name: "Setup" })).getByRole("button", { name });

  test("pills show the current setup and open one popover at a time", () => {
    render(<App />);
    expect(pill(/^Key: D\./)).toBeTruthy();
    expect(pill(/^Scale: Major/).getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(pill(/^Key/));
    expect(pill(/^Key/).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("radio", { name: "D", checked: true })).toBeTruthy();

    fireEvent.click(pill(/^Scale/));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(pill(/^Key/).getAttribute("aria-expanded")).toBe("false");
  });

  test("the scale popover stays open so scales can be compared one click each", () => {
    render(<App />);
    fireEvent.click(pill(/^Scale/));
    fireEvent.click(screen.getByRole("radio", { name: /^Dorian/ }));
    fireEvent.click(screen.getByRole("radio", { name: /^Lydian/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(pill(/^Scale: Lydian\./)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pill(/^Scale: Lydian\./)).toBe(document.activeElement);
  });

  test("Escape and an outside click close the popover", () => {
    render(<App />);
    fireEvent.click(pill(/^Capo: \d/));
    expect(screen.getByRole("radio", { name: "Keep sound", checked: true })).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pill(/^Capo: \d/)).toBe(document.activeElement);

    fireEvent.click(pill(/^Tuning/));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
