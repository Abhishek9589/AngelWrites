import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DialogKind = "alert" | "confirm" | "prompt";

interface PendingDialog {
  kind: DialogKind;
  message: string;
  title?: string;
  defaultValue?: string;
  resolve: (value: unknown) => void;
}

interface DialogApi {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string, title?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<PendingDialog | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const show = useCallback((payload: Omit<PendingDialog, "resolve"> & { resolver?: (v: unknown) => void }) => {
    return new Promise<unknown>((resolve) => {
      setCurrent({
        kind: payload.kind,
        message: payload.message,
        title: payload.title,
        defaultValue: payload.defaultValue,
        resolve,
      });
      setOpen(true);
    });
  }, []);

  const api: DialogApi = useMemo(() => ({
    alert: async (message: string, title = "Notice") => {
      await show({ kind: "alert", message, title });
    },
    confirm: async (message: string, title = "Confirm") => {
      const res = (await show({ kind: "confirm", message, title })) as boolean;
      return !!res;
    },
    prompt: async (message: string, defaultValue = "", title = "Enter a value") => {
      const res = (await show({ kind: "prompt", message, title, defaultValue })) as string | null;
      return typeof res === "string" || res === null ? res : null;
    },
  }), [show]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prevAlert = window.alert;
    const prevConfirm = window.confirm;
    const prevPrompt = window.prompt;
    (window as any).alert = (msg?: any) => { api.alert(String(msg ?? "")); };
    (window as any).confirm = (msg?: any) => { api.confirm(String(msg ?? "")); return false; };
    (window as any).prompt = (msg?: any, def?: any) => { api.prompt(String(msg ?? ""), String(def ?? "")); return null; };
    return () => {
      window.alert = prevAlert;
      window.confirm = prevConfirm;
      window.prompt = prevPrompt;
    };
  }, [api]);

  const handleCancel = useCallback(() => {
    if (!current) return;
    if (current.kind === "prompt") current.resolve(null);
    if (current.kind === "confirm") current.resolve(false);
    if (current.kind === "alert") current.resolve(undefined);
    close();
  }, [current, close]);

  const handleConfirm = useCallback(() => {
    if (!current) return;
    if (current.kind === "prompt") current.resolve(inputRef.current?.value ?? "");
    if (current.kind === "confirm") current.resolve(true);
    if (current.kind === "alert") current.resolve(undefined);
    close();
  }, [current, close]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <DialogContent titleText={current?.title || "Dialog"}>
          <DialogHeader>
            <DialogTitle>{current?.title || "Dialog"}</DialogTitle>
            <DialogDescription>{current?.message || ""}</DialogDescription>
          </DialogHeader>
          {current?.kind === "prompt" && (
            <div className="mt-2">
              <Input
                ref={inputRef}
                defaultValue={current?.defaultValue ?? ""}
                placeholder="Type here"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                }}
              />
            </div>
          )}
          <DialogFooter>
            {current?.kind !== "alert" && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={handleConfirm}>
              {current?.kind === "confirm" ? "Confirm" : current?.kind === "prompt" ? "Save" : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}
