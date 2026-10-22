#!/usr/bin/env python3
"""GUI to rename quest logs and set first/second playthrough in Wind Waker HD's cking.sav.

Needs wwhd_save.py in the same folder.
"""
import tkinter as tk
from tkinter import filedialog, ttk

from wwhd_save import (MAX_NAME, SLOT_COUNT, is_second_quest, load_save, read_name, set_second_quest,
                       validate_name, write_name, write_save)

FIRST, SECOND = "First playthrough", "Second playthrough (Hero's clothes)"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("WWHD Save Editor")
        self.resizable(False, False)
        self.path = self.buf = None
        self.name_vars = [tk.StringVar() for _ in range(SLOT_COUNT)]
        self.mode_vars = [tk.StringVar(value=FIRST) for _ in range(SLOT_COUNT)]
        self.folder_var = tk.StringVar()

        frm = ttk.Frame(self, padding=16)
        frm.grid()
        ttk.Label(frm, text="Save folder (contains cking.sav):").grid(row=0, column=0, columnspan=3, sticky="w")
        folder = ttk.Entry(frm, textvariable=self.folder_var, width=52)
        folder.grid(row=1, column=0, columnspan=2, sticky="we", pady=4)
        folder.bind("<Return>", lambda e: self.load())
        ttk.Button(frm, text="Browse...", command=self.browse).grid(row=1, column=2, padx=(6, 0))
        ttk.Button(frm, text="Load", command=self.load).grid(row=2, column=2, padx=(6, 0))

        grid = ttk.Frame(frm)
        grid.grid(row=3, column=0, columnspan=3, pady=(12, 0))
        for col, text in enumerate(("Quest Log", "Name", "Playthrough")):
            ttk.Label(grid, text=text, font=("", 10, "bold")).grid(row=0, column=col, padx=6, pady=4)
        self.inputs = []
        for i in range(SLOT_COUNT):
            ttk.Label(grid, text=f"Quest Log {i + 1}").grid(row=i + 1, column=0, padx=6, pady=6, sticky="w")
            e = ttk.Entry(grid, textvariable=self.name_vars[i], width=14)
            e.grid(row=i + 1, column=1, padx=6)
            c = ttk.Combobox(grid, textvariable=self.mode_vars[i], values=[FIRST, SECOND], state="readonly", width=32)
            c.grid(row=i + 1, column=2, padx=6)
            self.inputs += [e, c]
        ttk.Label(frm, text=f"Names: 1-{MAX_NAME} characters, ASCII only.").grid(
            row=4, column=0, columnspan=3, pady=(8, 0), sticky="w")
        self.save_btn = ttk.Button(frm, text="Save", command=self.save)
        self.save_btn.grid(row=5, column=0, columnspan=3, pady=(12, 0))
        self.status = tk.Label(frm, text="Choose your save folder to begin.", wraplength=460, justify="left",
                               anchor="w")
        self.status.grid(row=6, column=0, columnspan=3, pady=(10, 0), sticky="we")
        self.set_editable(False)

    def set_status(self, text, kind="info"):
        self.status.config(text=text, fg={"error": "#b00020", "ok": "#1b7a1b"}.get(kind, "#444444"))

    def set_editable(self, on):
        state = "normal" if on else "disabled"
        for w in self.inputs:
            w.config(state="readonly" if on and isinstance(w, ttk.Combobox) else state)
        self.save_btn.config(state=state)

    def browse(self):
        folder = filedialog.askdirectory(title="Select the folder containing cking.sav")
        if folder:
            self.folder_var.set(folder)
            self.load()

    def load(self):
        folder = self.folder_var.get().strip()
        self.set_editable(False)
        if not folder:
            self.set_status("Enter or browse to a save folder first.", "error")
            return
        try:
            self.path, self.buf = load_save(folder)
        except (ValueError, OSError) as e:
            self.set_status(str(e), "error")
            return
        for i in range(SLOT_COUNT):
            self.name_vars[i].set(read_name(self.buf, i))
            self.mode_vars[i].set(SECOND if is_second_quest(self.buf, i) else FIRST)
        self.set_editable(True)
        self.set_status(f"Loaded {self.path}", "ok")

    def save(self):
        try:
            names = [validate_name(v.get()) for v in self.name_vars]
        except ValueError as e:
            self.set_status(str(e), "error")
            return
        try:
            for i in range(SLOT_COUNT):
                write_name(self.buf, i, names[i])
                set_second_quest(self.buf, i, self.mode_vars[i].get() == SECOND)
            backup = write_save(self.path, self.buf)
        except OSError as e:
            self.set_status(f"Save failed: {e}", "error")
            return
        self.set_status(f"Changes have been made. Please close and reopen the game.\nBackup: {backup.name}", "ok")


def main():
    App().mainloop()


if __name__ == "__main__":
    main()
