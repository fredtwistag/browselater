import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the service client and error reporter before importing ai.ts. The mock
// fns live in vi.hoisted so the vi.mock factories (themselves hoisted above the
// import) can reference them, and the tests can assert on them.
const mocks = vi.hoisted(() => {
  const tagsSelect = vi.fn(
    (): Promise<{ data: Array<{ id: string; name: string }> | null; error: Error | null }> =>
      Promise.resolve({ data: [], error: null }),
  );
  const tagsUpsert = vi.fn(
    (
      _rows: Array<{ user_id: string; name: string }>,
      _opts?: { onConflict: string; ignoreDuplicates: boolean },
    ) => ({ select: tagsSelect }),
  );
  const itemTagsUpsert = vi.fn(
    (
      _rows: Array<{ item_id: string; tag_id: string; source: string }>,
    ): Promise<{ error: Error | null }> => Promise.resolve({ error: null }),
  );
  const fromMock = vi.fn((table: string) => {
    if (table === "tags") return { upsert: tagsUpsert };
    if (table === "item_tags") return { upsert: itemTagsUpsert };
    throw new Error(`unexpected table: ${table}`);
  });
  const captureError = vi.fn(
    (_source: string, _err: unknown, _ctx?: Record<string, unknown>, _userId?: string) => {},
  );
  return { tagsSelect, tagsUpsert, itemTagsUpsert, fromMock, captureError };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mocks.fromMock }),
}));
vi.mock("@/lib/errors", () => ({ captureError: mocks.captureError }));

import { saveTags } from "./ai";

const USER = "00000000-0000-0000-0000-000000000001";
const ITEM = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  // Restore happy-path return values (clearAllMocks keeps implementations but
  // any per-test mockResolvedValue override would otherwise leak).
  mocks.tagsSelect.mockResolvedValue({ data: [], error: null });
  mocks.itemTagsUpsert.mockResolvedValue({ error: null });
});

describe("saveTags", () => {
  it("upserts deduped/normalized tags and links them in one item_tags upsert", async () => {
    mocks.tagsSelect.mockResolvedValue({
      data: [
        { id: "tag-1", name: "ai" },
        { id: "tag-2", name: "react" },
      ],
      error: null,
    });

    await saveTags(ITEM, USER, [" AI ", "React"]);

    expect(mocks.tagsUpsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = mocks.tagsUpsert.mock.calls[0];
    expect(rows).toEqual([
      { user_id: USER, name: "ai" },
      { user_id: USER, name: "react" },
    ]);
    expect(opts).toEqual({ onConflict: "user_id,name", ignoreDuplicates: false });

    expect(mocks.itemTagsUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.itemTagsUpsert.mock.calls[0][0]).toEqual([
      { item_id: ITEM, tag_id: "tag-1", source: "ai" },
      { item_id: ITEM, tag_id: "tag-2", source: "ai" },
    ]);
    expect(mocks.captureError).not.toHaveBeenCalled();
  });

  it("makes no DB calls for empty or whitespace-only tags", async () => {
    await saveTags(ITEM, USER, []);
    await saveTags(ITEM, USER, ["", "   ", "\t\n"]);
    expect(mocks.fromMock).not.toHaveBeenCalled();
    expect(mocks.captureError).not.toHaveBeenCalled();
  });

  it("reports a tags-upsert error via captureError and skips the item_tags upsert", async () => {
    mocks.tagsSelect.mockResolvedValue({ data: null, error: new Error("boom") });

    await saveTags(ITEM, USER, ["ai"]);

    expect(mocks.captureError).toHaveBeenCalledTimes(1);
    expect(mocks.captureError.mock.calls[0][0]).toBe("ai.save_tags");
    expect(mocks.itemTagsUpsert).not.toHaveBeenCalled();
  });

  it("dedupes names that differ only by case or surrounding whitespace", async () => {
    mocks.tagsSelect.mockResolvedValue({ data: [{ id: "tag-1", name: "ai" }], error: null });

    await saveTags(ITEM, USER, ["AI", " ai ", "Ai"]);

    expect(mocks.tagsUpsert).toHaveBeenCalledTimes(1);
    const [rows] = mocks.tagsUpsert.mock.calls[0];
    expect(rows).toEqual([{ user_id: USER, name: "ai" }]);
  });

  it("uses onConflict 'user_id,name' so concurrent runs merge instead of racing", async () => {
    mocks.tagsSelect.mockResolvedValue({ data: [{ id: "t", name: "x" }], error: null });

    await saveTags(ITEM, USER, ["x"]);

    expect(mocks.tagsUpsert.mock.calls[0][1]).toEqual({
      onConflict: "user_id,name",
      ignoreDuplicates: false,
    });
  });

  it("reports an item_tags-upsert error via captureError", async () => {
    mocks.tagsSelect.mockResolvedValue({ data: [{ id: "tag-1", name: "ai" }], error: null });
    mocks.itemTagsUpsert.mockResolvedValue({ error: new Error("link failed") });

    await saveTags(ITEM, USER, ["ai"]);

    expect(mocks.captureError).toHaveBeenCalledTimes(1);
    expect(mocks.captureError.mock.calls[0][0]).toBe("ai.save_item_tags");
  });
});
