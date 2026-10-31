"use client";

import { SemanticTextEditor } from "./semantic-text-editor";
import {
  TEXTUAL_ITEM_TYPES,
  type StructuredStimulusEmphasis,
} from "../../lib/text-emphasis";
import { Button } from "../ui/button";
import {
  newStructuredLayoutDraft,
  structuredDraftEmphasisAfterEdit,
  structuredLayout,
  STRUCTURED_LAYOUTS,
  type CellDraft,
  type StructuredDraft,
  type StructuredLayout,
} from "../../lib/exam-content";

const inputClass =
  "min-w-0 rounded-md border border-gray-300 bg-white p-2 text-sm";
const blank = (): CellDraft => ({ value: "" });

export function StructuredStimulusEditor({
  value,
  onChange: emitChange,
  emphasis,
}: {
  value: StructuredDraft | null;
  emphasis?: StructuredStimulusEmphasis;
  onChange: (
    value: StructuredDraft,
    emphasis: StructuredStimulusEmphasis,
  ) => void;
}) {
  const onChange = (next: StructuredDraft) =>
    emitChange(next, structuredDraftEmphasisAfterEdit(value, next, emphasis));
  const textual = TEXTUAL_ITEM_TYPES.some((type) => type === value?.type);
  const layout = value ? structuredLayout(value.type) : null;
  const grid = layout === "GRID";
  const cells = grid ? (value?.rows ?? []) : [value?.items ?? []];
  const changeCell = (
    row: number,
    column: number,
    patch: Partial<CellDraft>,
  ) => {
    if (!value) return;
    if (grid)
      onChange({
        ...value,
        rows: value.rows.map((cells, i) =>
          i === row
            ? cells.map((cell, j) =>
                j === column ? { ...cell, ...patch } : cell,
              )
            : cells,
        ),
      });
    else
      onChange({
        ...value,
        items: value.items.map((cell, j) =>
          j === column ? { ...cell, ...patch } : cell,
        ),
      });
  };
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Structured layout
        <select
          className={`${inputClass} mt-1 block w-full`}
          value={layout ?? ""}
          onChange={(event) => {
            const next = event.target.value as StructuredLayout;
            if (next !== layout) onChange(newStructuredLayoutDraft(next));
          }}
        >
          <option value="" disabled>
            Choose a layout
          </option>
          {STRUCTURED_LAYOUTS.map((family) => (
            <option key={family.value} value={family.value}>
              {family.label}
            </option>
          ))}
        </select>
      </label>
      {!value ? (
        <p role="alert" className="text-sm text-amber-900">
          Choose a layout to create or replace structured content.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-600">
            Keep item order and row boundaries. Use ? for a missing value.
            Adding/removing items clears structured formatting. Changing layout
            replaces the current rows/items and clears their formatting.
          </p>
          <div className="space-y-3 overflow-x-auto">
            {cells.map((row, rowIndex) => (
              <fieldset key={rowIndex} className="space-y-2 rounded border p-3">
                <legend className="px-1 text-xs font-semibold">
                  {grid ? `Row ${rowIndex + 1}` : "Items"}
                </legend>
                <div className={grid ? "flex flex-wrap gap-2" : "space-y-2"}>
                  {row.map((cell, columnIndex) => (
                    <div key={columnIndex} className="flex items-center gap-2">
                      {textual ? (
                        <SemanticTextEditor
                          label={`Item ${columnIndex + 1}`}
                          text={cell.value}
                          emphasis={
                            emphasis?.find(
                              (entry) => entry.index === columnIndex,
                            )?.spans
                          }
                          maxLength={500}
                          rows={1}
                          onChange={(text, spans) => {
                            const next = {
                              ...value,
                              items: value.items.map((item, index) =>
                                index === columnIndex
                                  ? { ...item, value: text }
                                  : item,
                              ),
                            };
                            const entries = (emphasis ?? []).filter(
                              (entry) => entry.index !== columnIndex,
                            );
                            if (spans)
                              entries.push({ index: columnIndex, spans });
                            emitChange(
                              next,
                              entries.length
                                ? entries.sort((a, b) => a.index - b.index)
                                : null,
                            );
                          }}
                        />
                      ) : (
                        <input
                          aria-label={`${grid ? `Row ${rowIndex + 1} cell` : "Item"} ${columnIndex + 1}`}
                          className={`${inputClass} ${grid ? "w-32" : "w-full"}`}
                          maxLength={500}
                          value={cell.value}
                          onChange={(event) =>
                            changeCell(rowIndex, columnIndex, {
                              value: event.target.value,
                            })
                          }
                        />
                      )}
                      {!grid && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={row.length <= 1}
                          onClick={() =>
                            onChange({
                              ...value,
                              items: value.items.filter(
                                (_, index) => index !== columnIndex,
                              ),
                            })
                          }
                          aria-label={`Remove item ${columnIndex + 1}`}
                        >
                          Remove item
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {grid && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cells.length <= 1}
                    onClick={() =>
                      onChange({
                        ...value,
                        rows: value.rows.filter(
                          (_, index) => index !== rowIndex,
                        ),
                      })
                    }
                  >
                    Remove row
                  </Button>
                )}
              </fieldset>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {grid ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value.rows.length >= 30}
                  onClick={() =>
                    onChange({
                      ...value,
                      rows: [...value.rows, value.rows[0].map(blank)],
                    })
                  }
                >
                  Add row
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value.rows[0].length >= 30}
                  onClick={() =>
                    onChange({
                      ...value,
                      rows: value.rows.map((row) => [...row, blank()]),
                    })
                  }
                >
                  Add column
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value.rows[0].length <= 1}
                  onClick={() =>
                    onChange({
                      ...value,
                      rows: value.rows.map((row) => row.slice(0, -1)),
                    })
                  }
                >
                  Remove last column
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={value.items.length >= 100}
                onClick={() =>
                  onChange({ ...value, items: [...value.items, blank()] })
                }
              >
                Add item
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
