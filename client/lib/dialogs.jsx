import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * @typedef {'alert'|'confirm'|'prompt'} DialogKind
 */

/**
 * @typedef {Object} PendingDialog
 * @property {DialogKind} kind
 * @property {string} message
 * @property {string=} title
 * @property {string=} defaultValue
 * @property {(value: unknown)=>void} resolve
 */

/**
 * @typedef {Object} DialogApi
 * @property {(message:string, title?:string)=>Promise<void>} alert
 * @property {(message:string, title?:string)=>Promise<boolean>} confirm
 * @property {(message:string, defaultValue?:string, title?:string)=>Promise<string|null>} prompt
 */

const DialogContext = createContext(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const inputRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const show = useCallback((payload) => {
    return new Promise((resolve) => {
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

  const api = useMemo(() => ({
    alert: async (message, title = "Notice") => {
      await show({ kind: "alert", message, title });
    },
    confirm: async (message, title = "Confirm") => {
      const res = (await show({ kind: "confirm", message, title }));
      return !!res;
    },
    prompt: async (message, defaultValue = "", title = "Enter a value") => {
      const res = (await show({ kind: "prompt", message, title, defaultValue }));
      return typeof res === "string" || res === null ? res : null;
    },
  }), [show]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prevAlert = window.alert;
    const prevConfirm = window.confirm;
    const prevPrompt = window.prompt;
    window.alert = (msg) => { api.alert(String(msg ?? "")); };
    window.confirm = (msg) => { api.confirm(String(msg ?? "")); return false; };
    window.prompt = (msg, def) => { api.prompt(String(msg ?? ""), String(def ?? "")); return null; };
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
