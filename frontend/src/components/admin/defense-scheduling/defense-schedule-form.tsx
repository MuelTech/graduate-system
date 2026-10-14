"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleFormState } from "./types";

type Props = {
  value: ScheduleFormState;
  onChange: (next: ScheduleFormState) => void;
  errors?: { date?: string; time?: string; venue?: string };
};

export function DefenseScheduleForm({ value, onChange, errors }: Props) {
  const set = (patch: Partial<ScheduleFormState>) =>
    onChange({ ...value, ...patch });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          Defense Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs" htmlFor="defense-date">
              Date
            </Label>
            <Input
              id="defense-date"
              type="date"
              value={value.defenseDate}
              onChange={(e) => set({ defenseDate: e.target.value })}
              aria-invalid={!!errors?.date}
              aria-describedby={errors?.date ? "defense-date-error" : undefined}
              className="mt-1"
            />
            {errors?.date && (
              <p id="defense-date-error" className="mt-1 text-xs text-destructive">
                {errors.date}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs" htmlFor="defense-time">
              Time
            </Label>
            <Input
              id="defense-time"
              type="time"
              value={value.defenseTime}
              onChange={(e) => set({ defenseTime: e.target.value })}
              aria-invalid={!!errors?.time}
              aria-describedby={errors?.time ? "defense-time-error" : undefined}
              className="mt-1"
            />
            {errors?.time && (
              <p id="defense-time-error" className="mt-1 text-xs text-destructive">
                {errors.time}
              </p>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs" htmlFor="venue-or-link">
            Venue / Meeting Details
          </Label>
          <Input
            id="venue-or-link"
            type="text"
            value={value.venueOrLink}
            onChange={(e) => set({ venueOrLink: e.target.value })}
            placeholder="Room / venue, or https:// meeting link"
            aria-invalid={!!errors?.venue}
            aria-describedby={errors?.venue ? "venue-or-link-error" : undefined}
            className="mt-1"
          />
          {errors?.venue ? (
            <p id="venue-or-link-error" className="mt-1 text-xs text-destructive">
              {errors.venue}
            </p>
          ) : (
            <p className="mt-1 text-xs text-(--earist-body-text)">
              Enter a physical venue, or a complete http/https meeting link.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
