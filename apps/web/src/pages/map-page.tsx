import { useCallback, useMemo, useState, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import { TraceMap, type TraceWithTags } from "@/components/map/trace-map";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MapPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeJournalId, loading: journalLoading } = useJournal();
  const [formOpen, setFormOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
  const [filterTagIds, setFilterTagIdsState] = useState<Set<string>>(() => new Set());
  const setFilterTagIds = useCallback((action: SetStateAction<Set<string>>) => {
    setFilterTagIdsState((prev) => (typeof action === "function" ? action(prev) : action));
  }, []);

  const tracesQuery = useQuery({
    queryKey: ["traces", activeJournalId],
    queryFn: async () => {
      if (!activeJournalId) return [];
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) )`,
        )
        .eq("journal_id", activeJournalId)
        .order("visited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TraceWithTags[];
    },
    enabled: Boolean(activeJournalId) && !journalLoading,
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", activeJournalId],
    queryFn: async () => {
      if (!activeJournalId) return [];
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("journal_id", activeJournalId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(activeJournalId) && !journalLoading,
  });

  const onSelectTrace = useCallback(
    (id: string) => {
      navigate(`/traces/${id}`);
    },
    [navigate],
  );

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);

  const center = useMemo(() => {
    if (traces.length === 0) return { lat: 20, lng: 0 };
    return { lat: traces[0].lat, lng: traces[0].lng };
  }, [traces]);

  async function createTag() {
    if (!activeJournalId || !newTagName.trim()) return;
    const { error } = await supabase.from("tags").insert({
      journal_id: activeJournalId,
      name: newTagName.trim(),
      color: newTagColor,
      icon_emoji: newTagEmoji || "📍",
    });
    if (!error) {
      setNewTagName("");
      setTagDialogOpen(false);
      await qc.invalidateQueries({ queryKey: ["tags", activeJournalId] });
    }
  }

  if (journalLoading || !activeJournalId) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center text-sm">
        {!activeJournalId ? "No journal available." : "Loading journal…"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <div className="flex min-h-[50vh] flex-1 flex-col gap-2 lg:min-h-[calc(100svh-4rem)]">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Add trace
          </Button>
          <Button variant="outline" onClick={() => setTagDialogOpen(true)}>
            <Tag className="size-4" />
            New tag
          </Button>
        </div>
        <TraceMap
          traces={traces}
          selectedTagIds={filterTagIds}
          onSelectTrace={onSelectTrace}
        />
        <TraceFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          journalId={activeJournalId}
          trace={null}
          defaultLat={center.lat}
          defaultLng={center.lng}
        />
        <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New tag</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Name</Label>
                <Input id="tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag-color">Color</Label>
                <Input
                  id="tag-color"
                  type="color"
                  className="h-10 w-full cursor-pointer"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag-emoji">Icon (emoji)</Label>
                <Input id="tag-emoji" value={newTagEmoji} onChange={(e) => setNewTagEmoji(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void createTag()}>Create tag</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="w-full shrink-0 lg:w-72">
        <CardHeader>
          <CardTitle className="text-base">Filter by tag</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(tagsQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No tags yet.</p>
          ) : (
            (tagsQuery.data ?? []).map((tag) => (
              <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={filterTagIds.has(tag.id)}
                  onCheckedChange={(c) => {
                    setFilterTagIds((prev) => {
                      const next = new Set(prev);
                      if (c === true) next.add(tag.id);
                      else next.delete(tag.id);
                      return next;
                    });
                  }}
                />
                <span>{tag.icon_emoji}</span>
                <span>{tag.name}</span>
              </label>
            ))
          )}
          {filterTagIds.size > 0 ? (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterTagIds(new Set())}>
              Clear filters
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
