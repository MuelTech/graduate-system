"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleFormState } from "./types";

type Props = {
  value: ScheduleFormState;
  onChange: (next: ScheduleFormState) => void;
  errors?: { date?: string; time?: string; link?: string };
};

export function DefenseScheduleForm({ value, onChange, errors }: Props) {
  const set = (patch: Partial<ScheduleFormState>) =>
    onChange({ ...value, ...patch });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          3. Defense Schedule
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
              <p id="defense-date-error" className="mt-1 text-xs text-red-600">
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
              <p id="defense-time-error" className="mt-1 text-xs text-red-600">
                {errors.time}
              </p>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs" htmlFor="meeting-link">
            MS Teams Link
          </Label>
          <Input
            id="meeting-link"
            type="url"
            value={value.meetingLink}
            onChange={(e) => set({ meetingLink: e.target.value })}
            placeholder="https://teams.microsoft.com/..."
            aria-invalid={!!errors?.link}
            aria-describedby={errors?.link ? "meeting-link-error" : undefined}
            className="mt-1"
          />
          {errors?.link && (
            <p id="meeting-link-error" className="mt-1 text-xs text-red-600">
              {errors.link}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
