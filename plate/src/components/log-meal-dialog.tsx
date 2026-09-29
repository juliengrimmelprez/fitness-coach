"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { analyzeMealPhoto } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image";
import { insertMeal, uploadPhoto } from "@/lib/meals";
import { ZERO } from "@/lib/nutrition";
import { SLOTS, localDateString, slotForTime } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Meal, MealSlot } from "@/lib/types";

type Stage = "idle" | "compressing" | "uploading" | "analyzing" | "saving";

const STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  compressing: "Preparing photo…",
  uploading: "Uploading…",
  analyzing: "Identifying ingredients and weighing portions… (~20 s)",
  saving: "Saving…",
};

export function LogMealDialog({
  open,
  onOpenChange,
  userId,
  date,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  date: string;
  onLogged: (meal: Meal) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // The parent remounts this dialog on every open, so these initial values are the reset.
  const [slot, setSlot] = useState<MealSlot>(() => (date === localDateString() ? slotForTime() : "lunch"));
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const busy = stage !== "idle";

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("That file isn't an image.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    let imagePath: string | null = null;
    try {
      setStage("compressing");
      const blob = await compressImage(file);
      setStage("uploading");
      imagePath = await uploadPhoto(userId, blob);
      setStage("analyzing");
      const result = await analyzeMealPhoto({ imagePath, note });
      if (!result.ok) throw new Error(result.error);
      setStage("saving");
      const meal = await insertMeal({ userId, date, slot, imagePath, analysis: result.data });
      onLogged(meal);
      onOpenChange(false);
      toast.success(`${meal.name} logged: ${Math.round(meal.calories)} kcal`);
    } catch (error) {
      // Don't leave an orphaned photo behind if analysis or saving failed.
      if (imagePath) await supabaseBrowser().storage.from("meal-photos").remove([imagePath]);
      toast.error(error instanceof Error ? error.message : "Couldn't log this meal.");
      setStage("idle");
    }
  }

  async function addManually() {
    try {
      setStage("saving");
      const meal = await insertMeal({
        userId,
        date,
        slot,
        imagePath: null,
        analysis: {
          name: note.trim() || "Custom meal",
          description: "",
          portion: "",
          ingredients: [],
          micros: [],
          confidence: "high",
          ...ZERO,
        },
      });
      onLogged(meal);
      onOpenChange(false);
      toast.success("Meal added. Now add its ingredients.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add this meal.");
      setStage("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a meal</DialogTitle>
          <DialogDescription>Snap a photo. We&apos;ll break it into ingredients and weigh each one.</DialogDescription>
        </DialogHeader>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={pick} />

        {preview ? (
          <button type="button" onClick={() => libraryRef.current?.click()} disabled={busy} className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selected meal" className="aspect-[4/3] w-full object-cover" />
            {!busy && <span className="absolute right-2 bottom-2 rounded-md bg-background/80 px-2 py-1 text-xs">Change</span>}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-24 flex-col" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-6" />
              Take photo
            </Button>
            <Button variant="outline" className="h-24 flex-col" onClick={() => libraryRef.current?.click()}>
              <ImagePlus className="size-6" />
              From library
            </Button>
          </div>
        )}

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="slot">Meal</Label>
            <select
              id="slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value as MealSlot)}
              disabled={busy}
              className="h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm"
            >
              {SLOTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              placeholder="e.g. dressing on the side, ate half the rice"
            />
          </div>
        </div>

        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {STAGE_TEXT[stage]}
          </p>
        )}

        <div className="grid gap-2">
          <Button size="lg" onClick={analyze} disabled={!file || busy}>
            Analyze meal
          </Button>
          <Button variant="ghost" size="sm" onClick={addManually} disabled={busy}>
            <PencilLine />
            No photo? Add ingredients manually
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
