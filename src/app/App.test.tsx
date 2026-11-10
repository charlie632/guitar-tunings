// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "./App";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const panel = (name: RegExp) => within(screen.getByRole("region", { name }));
const go = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name }));

describe("App on DADF♯Ae in D major", () => {
  test("each section shows its panels", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Fretboard" }).getAttribute("aria-current")).toBe("page");

    const board = panel(/^Fretboard$/);
    expect(board.getByText(/DADF♯Ae, D major/)).toBeTruthy();
    expect(board.getAllByRole("button", { name: /tonic/ }).length).toBeGreaterThan(5);

    const fits = panel(/Best keys for this tuning/);
    expect(fits.getAllByRole("button")[0]!.textContent).toContain("D major");
    expect(fits.getByText("6/6 open strings in key, 5 in the tonic chord, low string is the root")).toBeTruthy();
    expect(panel(/^Capo$/).getByText("No capo, so the open strings sound as tuned.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Chords in D major/ })).toBeNull();

    go("Chords");
    const chords = panel(/Chords in D major/);
    expect(chords.getByRole("button", { name: "Bm", pressed: false })).toBeTruthy();
    expect(chords.getByText("vi")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /^Fretboard$/ })).toBeNull();

    go("Voicings");
    expect(panel(/Voicings for D/).getAllByRole("button").length).toBeGreaterThan(3);

    go("Progressions");
    const prog = panel(/^Progressions/);
    expect(prog.getAllByRole("listitem").map((li) => li.querySelector("header")?.textContent)).toEqual([
      "ID", "VA", "viBm", "IVG",
    ]);
    expect(prog.getByRole("button", { name: "Play loop" })).toBeTruthy();
  });

  test("picking the Dadd9 chip and following the link shows the all-open voicing with its badge", () => {
    render(<App />);
    go("Chords");
    fireEvent.click(panel(/Chords in D major/).getByRole("button", { name: "Dadd9" }));
    fireEvent.click(screen.getByRole("link", { name: "Voicings for Dadd9 →" }));
    expect(screen.getByRole("link", { name: "Voicings" }).getAttribute("aria-current")).toBe("page");
    const voicings = panel(/Voicings for Dadd9/);
    expect(voicings.getAllByText("6 open strings ring").length).toBeGreaterThan(0);
    expect(voicings.getAllByText("0 0 0 0 0 0").length).toBeGreaterThan(0);
    const switcher = within(screen.getByRole("group", { name: "Chords in D major" }));
    expect(switcher.getByRole("button", { name: /Dadd9/, pressed: true })).toBeTruthy();
  });

  test("the voicings section switches chords without leaving it", () => {
    render(<App />);
    go("Voicings");
    fireEvent.click(within(screen.getByRole("group", { name: "Chords in D major" })).getByRole("button", { name: /Bm/ }));
    expect(panel(/Voicings for Bm/)).toBeTruthy();
  });

  test("a progression step's chord opens its voicings", () => {
    render(<App />);
    go("Progressions");
    fireEvent.click(panel(/^Progressions/).getByRole("button", { name: "Voicings for Bm" }));
    expect(screen.getByRole("link", { name: "Voicings" }).getAttribute("aria-current")).toBe("page");
    expect(panel(/Voicings for Bm/)).toBeTruthy();
  });

  test("a section URL opens that section, and an old URL without one opens the fretboard", () => {
    window.history.replaceState(null, "", "/#view=progressions&c=2");
    render(<App />);
    expect(screen.getByRole("link", { name: "Progressions" }).getAttribute("aria-current")).toBe("page");
    expect(panel(/^Progressions/).getByRole("button", { name: "Play loop" })).toBeTruthy();
    cleanup();

    window.history.replaceState(null, "", "/#t=D2.A2.D3.F%233.A3.E4&c=0&k=2&s=major");
    render(<App />);
    expect(panel(/^Fretboard$/)).toBeTruthy();
  });

  test("switching sections keeps the settings and writes the section to the URL", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Capo up one fret" }));
    fireEvent.click(screen.getByRole("button", { name: "Capo up one fret" }));
    go("Chords");
    expect(panel(/Chords in D major/).getAllByText("C shape").length).toBeGreaterThan(0);
    const params = new URLSearchParams(window.location.hash.slice(1));
    expect(params.get("view")).toBe("chords");
    expect(params.get("c")).toBe("2");
    expect(screen.getByRole("link", { name: "Fretboard" }).getAttribute("href")).toContain("c=2");
  });

  test("raising the capo with the sound held shows the shape name and the capo sentence", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Capo up one fret" }));
    fireEvent.click(screen.getByRole("button", { name: "Capo up one fret" }));
    expect(panel(/^Capo$/).getByText(/Capo 2 raises every open string 2 semitones/)).toBeTruthy();
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
    go("Progressions");
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
