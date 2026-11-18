"use client";

import { useState } from "react";
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
  const [touched, setTouched] = useState({
    date: false,
    time: false,
    venue: false,
  });

  const set = (patch: Partial<ScheduleFormState>) =>
    onChange({ ...value, ...patch });

  const showDateError = touched.date && !!errors?.date;
  const showTimeError = touched.time && !!errors?.time;
  const showVenueError = touched.venue && !!errors?.venue;

  return (
    <Card className="border-gray-100 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-[#333333]">
          Defense Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label
              className="text-xs font-semibold text-gray-700"
              htmlFor="defense-date"
            >
              Date
            </Label>
            <Input
              id="defense-date"
              type="date"
              value={value.defenseDate}
              onChange={(e) => {
                setTouched((prev) => ({ ...prev, date: true }));
                set({ defenseDate: e.target.value });
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, date: true }))}
              aria-invalid={showDateError}
              aria-describedby={showDateError ? "defense-date-error" : undefined}
              className="mt-1.5 border-gray-200 bg-gray-50/40 focus:bg-white"
            />
            {showDateError && (
              <p id="defense-date-error" className="mt-1 text-xs text-destructive">
                {errors?.date}
              </p>
            )}
          </div>
          <div>
            <Label
              className="text-xs font-semibold text-gray-700"
              htmlFor="defense-time"
            >
              Time
            </Label>
            <Input
              id="defense-time"
              type="time"
              value={value.defenseTime}
              onChange={(e) => {
                setTouched((prev) => ({ ...prev, time: true }));
                set({ defenseTime: e.target.value });
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, time: true }))}
              aria-invalid={showTimeError}
              aria-describedby={showTimeError ? "defense-time-error" : undefined}
              className="mt-1.5 border-gray-200 bg-gray-50/40 focus:bg-white"
            />
            {showTimeError && (
              <p id="defense-time-error" className="mt-1 text-xs text-destructive">
                {errors?.time}
              </p>
            )}
          </div>
        </div>
        <div>
          <Label
            className="text-xs font-semibold text-gray-700"
            htmlFor="venue-or-link"
          >
            Venue / Meeting Details
          </Label>
          <Input
            id="venue-or-link"
            type="text"
            value={value.venueOrLink}
            onChange={(e) => {
              setTouched((prev) => ({ ...prev, venue: true }));
              set({ venueOrLink: e.target.value });
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, venue: true }))}
            placeholder="Room / venue, or https:// meeting link"
            aria-invalid={showVenueError}
            aria-describedby={showVenueError ? "venue-or-link-error" : undefined}
            className="mt-1.5 border-gray-200 bg-gray-50/40 focus:bg-white"
          />
          {showVenueError ? (
            <p id="venue-or-link-error" className="mt-1 text-xs text-destructive">
              {errors?.venue}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-gray-500">
              Enter a physical venue, or a complete http/https meeting link.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
