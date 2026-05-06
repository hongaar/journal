import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@curolia/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import { EmojiPicker } from "@/components/traces/emoji-picker";
import { journalViewHref } from "@/lib/app-paths";
import { useJournal } from "@/providers/journal-provider";
import { defaultJournalIcon } from "@/lib/journal-display-icon";

type NewJournalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewJournalDialog({
  open,
  onOpenChange,
}: NewJournalDialogProps) {
  const navigate = useNavigate();
  const { createJournal } = useJournal();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(() => defaultJournalIcon(false));
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    const { journal, error } = await createJournal(name.trim(), icon);
    setCreating(false);
    if (!error && journal?.slug) {
      onOpenChange(false);
      navigate(journalViewHref("map", journal.slug));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName("");
          setIcon(defaultJournalIcon(false));
        }
      }}
    >
      <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">
            New journal
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="jn">Name</Label>
            <Input
              id="jn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family trips"
            />
          </div>
          <EmojiPicker
            id="jn-icon"
            label="Icon"
            value={icon}
            onChange={setIcon}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={creating} onClick={() => void handleCreate()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
